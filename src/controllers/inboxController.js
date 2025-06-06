const db = require('../models');
const { uploadFileToS3 } = require('../utils/uploadFileS3');
const { v4: uuidv4 } = require("uuid");


const InboxController = {

    //Get all inboxes
    async getInboxes(req, res) {
    try {
        const userId = req.user.id;
        const { Op } = db.Sequelize;

        // --- 1. Xử lý các tham số đầu vào ---
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const category = req.query.category || 'inbox';
        
        // Mặc định sắp xếp theo `createdAt` cho thư nhận và thư đã gửi
        // Sắp xếp theo `updatedAt` cho thư nháp
        const defaultSortBy = category.toLowerCase() === 'draft' ? 'updatedAt' : 'createdAt';
        const sortBy = req.query.sortBy || defaultSortBy;
        const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase();

        // --- 2. Xây dựng các điều kiện lọc động ---
        const inboxWhere = {};    // Điều kiện cho bảng `Inbox`
        const statusWhere = {};   // Điều kiện cho bảng `InboxUserStatus`
        let isStatusRequired = false; // Cờ để quyết định dùng INNER JOIN hay LEFT JOIN

        // Xử lý lọc theo category hệ thống
        switch (category.toLowerCase()) {
            case 'sent':
                inboxWhere.from = userId;
                inboxWhere.isSent = true;
                break;
            case 'draft':
                inboxWhere.from = userId;
                inboxWhere.isSent = false;
                break;
            case 'starred':
                statusWhere.userId = userId;
                statusWhere.isStarred = true;
                statusWhere.isDeleted = false;
                isStatusRequired = true;
                break;
            case 'spam':
                statusWhere.userId = userId;
                statusWhere.isSpam = true;
                isStatusRequired = true;
                break;
            case 'trash':
                statusWhere.userId = userId;
                statusWhere.isDeleted = true;
                isStatusRequired = true;
                break;
            case 'inbox':
            default:
                statusWhere.userId = userId;
                statusWhere.recipientType = { [Op.in]: ['to', 'cc', 'bcc'] };
                statusWhere.isSpam = false;
                statusWhere.isDeleted = false;
                isStatusRequired = true;
                break;
        }

        // Xử lý các filter tùy chọn (isRead, isStarred...)
        // Sẽ ghi đè lên thiết lập mặc định của category nếu được cung cấp
        const statusFields = ['isRead', 'isStarred', 'isSpam', 'isDeleted'];
        for (const field of statusFields) {
            if (req.query[field] !== undefined) {
                statusWhere[field] = req.query[field] === 'true';
            }
        }

        // Xử lý lọc theo nhãn tùy chỉnh
        let labelFilter = req.query.label;
        if (labelFilter && typeof labelFilter === 'string') {
            labelFilter = labelFilter.split(',').map(item => item.trim());
        }

        // --- 3. Xây dựng các đối tượng `include` ---
        const includeLabels = {
            model: db.UserLabel,
            as: 'labels',
            where: labelFilter ? { labelName: { [Op.in]: labelFilter } } : undefined,
            required: !!labelFilter, // Chỉ INNER JOIN khi có lọc label
            attributes: ['id', 'labelName']
        };

        const includeStatus = {
            model: db.InboxUserStatus,
            as: 'status',
            where: statusWhere,
            required: isStatusRequired,
            include: [
                { model: db.User, attributes: ['id', 'name', 'phoneNumber'] },
                includeLabels
            ]
        };

        // --- 4. Thực thi câu truy vấn duy nhất ---
        const { count, rows } = await db.Inbox.findAndCountAll({
            where: inboxWhere,
            include: [
                {
                    model: db.User,
                    as: 'FromUser',
                    attributes: ['id', 'name', 'phoneNumber', 'imageUrl']
                },
                // { model: db.Inbox, as: 'Replies' }, // Bỏ comment nếu cần
                includeStatus
            ],
            order: [[sortBy, sortOrder]],
            limit,
            offset,
            distinct: true,
        });

        // --- 5. Trả về kết quả ---
        res.status(200).json({
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalMessages: count,
            inbox: rows
        });

    } catch (err) {
        console.error('Error fetching inbox:', err);
        res.status(500).json({ message: 'Error fetching inbox', error: err.message });
    }
},


    //sendInbox
    async sendInbox(req, res) {
        try {
            const fromUserId = req.user.id;
            const { phoneNumbers, cc, bcc, subject, body, attachments, parentInboxId, isSent } = req.body;

            // Giữ nguyên: Kiểm tra mảng phoneNumbers có chứa ít nhất một số điện thoại
            if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
                return res.status(400).json({ message: 'phoneNumbers must be a non-empty array' });
            }

            // Giữ nguyên: Lấy và map UUID của người dùng
            const allPhoneNumbers = [...new Set([...phoneNumbers, ...cc, ...bcc])];
            const users = await db.User.findAll({
                where: { phoneNumber: allPhoneNumbers }
            });
            const userMap = users.reduce((acc, user) => {
                acc[user.phoneNumber] = user.id;
                return acc;
            }, {});
            const toUUIDs = phoneNumbers.map(phone => userMap[phone]).filter(Boolean);
            const ccUUIDs = cc.map(phone => userMap[phone]).filter(Boolean);
            const bccUUIDs = bcc.map(phone => userMap[phone]).filter(Boolean);

            // Giữ nguyên: Kiểm tra người dùng thiếu
            const missingPhoneNumbers = allPhoneNumbers.filter(phone => !userMap[phone]);
            if (missingPhoneNumbers.length > 0) {
                return res.status(400).json({
                    message: 'Some users not found in the database',
                    missingUsers: missingPhoneNumbers
                });
            }

            // Giữ nguyên: Logic xử lý Draft
            if (!isSent) {
                const draft = await db.Inbox.create({
                    from: fromUserId,
                    parentInboxId: parentInboxId,
                    body: body,
                    subject: subject,
                    attachments: attachments,
                    draft: {
                        to: toUUIDs,
                        cc: ccUUIDs,
                        bcc: bccUUIDs
                    }
                });
                if (!draft) {
                    return res.status(400).json({ message: 'Failed creating draft' });
                }
                //Add status cho chính cái draft này, nhằm mục đích để xóa.
                const statusDraft = await db.InboxUserStatus.create({
                    inboxId: draft.id,
                    userId : fromUserId,
                    recipientType: null


                    
                });

                if (!statusDraft) {
                    return res.status(400).json({ message: 'Failed creating draft status' });
                }

                return res.status(200).json({ message: 'Draft saved successfully', data: draft });
            } else {
                // Logic gửi tin nhắn
                const t = await db.sequelize.transaction();
                try {
                    const newInbox = await db.Inbox.create({
                        from: fromUserId, // <-- Trường `from` là chìa khóa cho "Thư đã gửi"
                        parentInboxId: parentInboxId,
                        body: body,
                        subject: subject,
                        attachments: attachments,
                        isSent: true
                    }, { transaction: t });

                    if (!newInbox) {
                        throw new Error('Failed to create inbox message.');
                    }

                    // LOGIC TẠO STATUS MỚI - CHỈ DÀNH CHO NGƯỜI NHẬN
                    const processedRecipients = new Map();

                    const addRecipientStatus = (userId, type) => {
                        if (userId && !processedRecipients.has(userId)) {
                            processedRecipients.set(userId, {
                                inboxId: newInbox.id,
                                userId: userId,
                                recipientType: type
                            });
                        }
                    };

                    // Áp dụng logic ưu tiên cho người nhận
                    toUUIDs.forEach(userId => addRecipientStatus(userId, 'to'));
                    ccUUIDs.forEach(userId => addRecipientStatus(userId, 'cc'));
                    bccUUIDs.forEach(userId => addRecipientStatus(userId, 'bcc'));

                    const statusesToCreate = Array.from(processedRecipients.values());

                    // Chỉ tạo status nếu có người nhận
                    if (statusesToCreate.length > 0) {
                        await db.InboxUserStatus.bulkCreate(statusesToCreate, { transaction: t });
                    }

                    await t.commit();
                    res.status(201).json({ message: 'Message sent successfully', data: newInbox });

                } catch (err) {
                    await t.rollback();
                    console.error(err);
                    res.status(500).json({ message: 'Error sending message', error: err.message });
                }
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error processing the request' });
        }
    },


    //Update, Delete Draft Inboxes




    //uploadAttachments

    async uploadAttachment(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            // Generate a new UUID for the uploaded file
            const fileUUID = uuidv4();

            // Upload the file to S3
            const fileData = await uploadFileToS3(req.file, fileUUID);

            // Here, you could update your database (e.g., Inboxes table) with the file metadata (fileUUID, fileName, etc.)

            return res.status(200).json({
                message: 'Attachment uploaded successfully',
                data: fileData,
            });
        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error uploading attachment' });
        }
    }


}


module.exports = InboxController