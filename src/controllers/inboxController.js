const db = require('../models');
const { extractPlainTextFromQuill } = require('../utils/getPlainBody');
const { uploadFileToS3 } = require('../utils/uploadFileS3');
const { v4: uuidv4 } = require("uuid");
const { Op } = db.Sequelize;

const InboxController = {



    async getInboxes(req, res) {
        try {
            const userId = req.user.id;s

            // --- 1. Xử lý tham số đầu vào ---
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const category = req.query.category || 'inbox';
            const defaultSortBy = category.toLowerCase() === 'draft' ? 'updatedAt' : 'createdAt';
            const sortBy = req.query.sortBy || defaultSortBy;
            const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase();

            const inboxWhere = {};
            const statusWhere = {};
            let isStatusRequired = false;

            // --- 2. Phân loại theo category ---
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
                    statusWhere.isSpam = false;
                    statusWhere.isDeleted = false;
                    inboxWhere.isSent = true;
                    isStatusRequired = true;
                    break;
            }

            // --- 3. Bổ sung filter nâng cao từ query ---
            const statusFields = ['isRead', 'isStarred', 'isSpam', 'isDeleted'];
            for (const field of statusFields) {
                if (req.query[field] !== undefined) {
                    statusWhere[field] = req.query[field] === 'true';
                }
            }

            // Lọc theo label
            let labelFilter = req.query.label;
            if (labelFilter && typeof labelFilter === 'string') {
                labelFilter = labelFilter.split(',').map(item => item.trim());
            }

            // Lọc theo từ khóa (subject & bodyText)
            const keywords = req.query.keywords?.trim();
            if (keywords) {
                const searchTerm = `%${keywords}%`;
                inboxWhere[Op.or] = [
                    { subject: { [Op.iLike]: searchTerm } },
                    { bodyText: { [Op.iLike]: searchTerm } }
                ];
            }

            // 5. Lọc theo khoảng thời gian
            const { startDate, endDate } = req.query;
            if (isNaN(Date.parse(startDate))) return res.status(400).json({ message: 'Invalid startDate' });

            if (startDate || endDate) {
                inboxWhere.createdAt = {};
                if (startDate) {
                    inboxWhere.createdAt[Op.gte] = new Date(startDate);
                }
                if (endDate) {
                    inboxWhere.createdAt[Op.lte] = new Date(endDate);
                }
            }

            // --- 4. Tạo các include ---
            const includeLabels = {
                model: db.UserLabel,
                as: 'labels',
                where: labelFilter ? { labelName: { [Op.in]: labelFilter } } : undefined,
                required: !!labelFilter,
                attributes: ['id', 'labelName']
            };

            const includeStatus = {
                model: db.InboxUserStatus,
                as: 'status',
                where: statusWhere,
                required: isStatusRequired,
                attributes: ['isRead', 'isStarred', 'isSpam', 'isDeleted'],
                include: [includeLabels]
            };

            // --- 5. Truy vấn chính ---
            const { count, rows } = await db.Inbox.findAndCountAll({
                attributes: {
                    exclude: ['attachments', 'body'],
                    include: [
                        [
                            db.Sequelize.literal(`(
                            SELECT jsonb_agg(elem->>'fileName') 
                            FROM jsonb_array_elements("Inbox"."attachments") AS elem
                        )`),
                            'attachmentFileNames'
                        ]
                    ]
                },
                where: inboxWhere,
                include: [
                    {
                        model: db.User,
                        as: 'FromUser',
                        attributes: ['id', 'name', 'imageUrl']
                    },
                    includeStatus
                ],
                order: [[sortBy, sortOrder]],
                limit,
                offset,
                distinct: true
            });

            // --- 6. Trả kết quả ---
            return res.status(200).json({
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                totalMessages: count,
                inbox: rows
            });

        } catch (err) {
            console.error('Error fetching inbox:', err);
            return res.status(500).json({
                message: 'Error fetching inbox',
                error: err.message
            });
        }
    }

    ,



    //sendInbox
    async sendInbox(req, res) {
        try {
            const fromUserId = req.user.id;
            const { phoneNumbers, cc, bcc, subject, body, attachments, parentInboxId, isSent } = req.body;
            const bodyText = extractPlainTextFromQuill(body)

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
                    bodyText: bodyText,
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
                    userId: fromUserId,
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
                        bodyText: bodyText,
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

                    processAutoReplies(statusesToCreate, newInbox);
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
    },


    async getInboxById(req, res) {
        try {
            const { inboxId } = req.params;
            const userId = req.user.id; // Lấy từ authMiddleware

            // Tìm inbox VÀ bao gồm trạng thái của user đang đăng nhập
            const inbox = await db.Inbox.findOne({
                where: { id: inboxId },
                include: [
                    {
                        model: db.InboxUserStatus,
                        as: 'status', // Đặt một alias (bí danh) để dễ truy cập
                        where: { userId: userId }, // **CHỈ LẤY STATUS CỦA USER NÀY**
                        required: true, // **BIẾN THÀNH INNER JOIN -> KIỂM TRA QUYỀN HẠN**
                        attributes: ['isRead', 'isStarred', 'isSpam', 'isDeleted'] // Chỉ lấy các trường cần thiết
                    },
                    // Bạn có thể include thêm các model khác ở đây nếu cần
                    // Ví dụ: Lấy thông tin người gửi
                    // {
                    //   model: db.User,
                    //   as: 'sender',
                    //   attributes: ['id', 'email', 'fullName']
                    // }
                ]
            });

            // Nếu `required: true` và không tìm thấy status của user, `inbox` sẽ là null
            if (!inbox) {
                return res.status(404).json({ message: "Inbox not found or you don't have permission to view it." });
            }

            // Trả về kết quả đã được gộp lại
            return res.status(200).json(inbox);

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error getting inbox details' });
        }
    },


    //Update inbox status 
    async updateInboxStatus(req, res) {
        try {
            const { inboxId } = req.params;
            const userId = req.user.id;

            const updates = req.body;

            const allowedUpdates = ['isRead', 'isStarred', 'isSpam', 'isDeleted'];

            const validUpdates = {};
            Object.keys(updates).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    validUpdates[key] = updates[key];
                }
            });

            if (Object.keys(validUpdates).length === 0) {
                return res.status(400).json({ message: "No valid status fields provided for update." });
            }

            // 2. Tìm và cập nhật (hoặc tạo mới) bản ghi trạng thái
            // Sử dụng `findOrCreate` hoặc `upsert` là lý tưởng nhất ở đây.
            // `findOrCreate` sẽ tìm bản ghi với inboxId và userId, nếu không có, nó sẽ tạo mới.
            const [statusRecord, created] = await db.InboxUserStatus.findOrCreate({
                where: {
                    inboxId: inboxId,
                    userId: userId
                },
                defaults: validUpdates // Nếu tạo mới, sử dụng các giá trị này
            });

            // 3. Nếu bản ghi đã tồn tại (không phải mới tạo), hãy cập nhật nó
            if (!created) {
                // Nếu bản ghi đã có từ trước, tiến hành cập nhật các trường được gửi lên
                await statusRecord.update(validUpdates);
            }

            // 4. Trả về kết quả
            res.status(200).json({
                message: 'Inbox status updated successfully.',
                status: statusRecord
            });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Failed to update inbox status' })
        }
    },


    // Thêm hàm này vào InboxController của bạn

    async updateInbox(req, res) {
        const t = await db.sequelize.transaction(); // Bắt đầu transaction ngay từ đầu
        try {
            const { inboxId } = req.params;
            const fromUserId = req.user.id;
            // Lấy tất cả dữ liệu từ body, bao gồm cả cờ isSent
            const { phoneNumbers, cc, bcc, subject, body, attachments, isSent } = req.body;
            const bodyText = extractPlainTextFromQuill(body)

            // Tìm bản nháp tương ứng
            const draft = await db.Inbox.findOne({ where: { id: inboxId } });

            if (!draft) {
                await t.rollback();
                return res.status(404).json({ message: 'Draft not found.' });
            }

            // KIỂM TRA QUYỀN: Đảm bảo người dùng chỉ có thể sửa draft của chính mình
            if (draft.from !== fromUserId) {
                await t.rollback();
                return res.status(403).json({ message: 'Forbidden: You cannot edit this draft.' });
            }

            // KIỂM TRA TRẠNG THÁI: Không thể gửi lại một email đã gửi
            if (draft.isSent) {
                await t.rollback();
                return res.status(400).json({ message: 'This message has already been sent.' });
            }

            // --- BẮT ĐẦU PHÂN LUỒNG LOGIC ---

            if (isSent === true) {
                // LUỒNG 1: GỬI DRAFT ĐI

                // Lấy và map UUID của người dùng (logic này giống hệt hàm sendInbox)
                const allPhoneNumbers = [...new Set([...(phoneNumbers || []), ...(cc || []), ...(bcc || [])])];
                const users = await db.User.findAll({ where: { phoneNumber: allPhoneNumbers } });
                const userMap = users.reduce((acc, user) => { acc[user.phoneNumber] = user.id; return acc; }, {});
                const toUUIDs = (phoneNumbers || []).map(phone => userMap[phone]).filter(Boolean);
                const ccUUIDs = (cc || []).map(phone => userMap[phone]).filter(Boolean);
                const bccUUIDs = (bcc || []).map(phone => userMap[phone]).filter(Boolean);

                // Cập nhật bản nháp thành email đã gửi
                await draft.update({
                    subject: subject,
                    body: body,
                    bodyText: bodyText,
                    attachments: attachments,
                    isSent: true, // <-- Chuyển trạng thái
                    draft: null,  // <-- Xóa thông tin người nhận nháp đi cho sạch sẽ
                }, { transaction: t });

                // Tạo status cho người nhận (logic này giống hệt hàm sendInbox)
                const processedRecipients = new Map();
                const addRecipientStatus = (userId, type) => {
                    if (userId && !processedRecipients.has(userId)) {
                        processedRecipients.set(userId, { inboxId: draft.id, userId: userId, recipientType: type });
                    }
                };
                toUUIDs.forEach(userId => addRecipientStatus(userId, 'to'));
                ccUUIDs.forEach(userId => addRecipientStatus(userId, 'cc'));
                bccUUIDs.forEach(userId => addRecipientStatus(userId, 'bcc'));

                const statusesToCreate = Array.from(processedRecipients.values());
                if (statusesToCreate.length > 0) {
                    await db.InboxUserStatus.bulkCreate(statusesToCreate, { transaction: t });
                }

                await t.commit();
                processAutoReplies(statusesToCreate, draft);
                res.status(200).json({ message: 'Draft sent successfully!', data: draft });

            } else {
                // LUỒNG 2: CHỈ CẬP NHẬT NỘI DUNG DRAFT (AUTO-SAVE)

                // Logic map UUID người nhận cho draft (giống ở trên nhưng không cần transaction)
                const allPhoneNumbers = [...new Set([...(phoneNumbers || []), ...(cc || []), ...(bcc || [])])];
                const users = await db.User.findAll({ where: { phoneNumber: allPhoneNumbers } });
                const userMap = users.reduce((acc, user) => { acc[user.phoneNumber] = user.id; return acc; }, {});
                const toUUIDs = (phoneNumbers || []).map(phone => userMap[phone]).filter(Boolean);
                const ccUUIDs = (cc || []).map(phone => userMap[phone]).filter(Boolean);
                const bccUUIDs = (bcc || []).map(phone => userMap[phone]).filter(Boolean);

                await draft.update({
                    subject: subject,
                    body: body,
                    bodyText: bodyText,
                    attachments: attachments,
                    draft: { // Cập nhật lại thông tin người nhận trong draft
                        to: toUUIDs,
                        cc: ccUUIDs,
                        bcc: bccUUIDs
                    }
                });
                // Không cần commit/rollback vì không dùng transaction cho việc save draft đơn giản
                res.status(200).json({ message: 'Draft updated successfully', data: draft });
            }

        } catch (err) {
            // Nếu có lỗi ở bất kỳ đâu, rollback transaction
            await t.rollback();
            console.error(err);
            res.status(500).json({ message: 'Error processing the request', error: err.message });
        }
    },

}



/**
 * Xử lý việc gửi email trả lời tự động cho những người nhận đã bật tính năng này.
 * Hàm này được thiết kế để chạy ngầm và không nên được `await`.
 * @param {Array} createdStatuses - Mảng các object status vừa được tạo.
 * @param {object} originalInbox - Object inbox gốc vừa được gửi.
 */
async function processAutoReplies(createdStatuses, originalInbox) {
    try {
        console.log('Bắt đầu xử lý trả lời tự động...');
        for (const status of createdStatuses) {
            const recipientId = status.userId;

            // Lấy thông tin cấu hình của người nhận
            const recipient = await db.User.findOne({
                where: { id: recipientId },
                attributes: ['id', 'isAutoReplyEnabled', 'autoReplySubject', 'autoReplyBody']
            });

            // Nếu người nhận có bật trả lời tự động và có nội dung trả lời
            if (recipient && recipient.isAutoReplyEnabled && recipient.autoReplyBody) {

                // QUAN TRỌNG: Ngăn chặn vòng lặp trả lời tự động vô hạn
                // Nếu email gốc đã là một email trả lời tự động thì không trả lời nữa
                if (originalInbox.subject.includes('[Auto-Reply]')) {
                    console.log(`Bỏ qua auto-reply cho ${recipientId} vì email gốc đã là auto-reply.`);
                    continue; // Chuyển sang người tiếp theo
                }

                console.log(`Phát hiện ${recipientId} có bật auto-reply. Đang tạo email trả lời...`);

                const fromUserId = recipient.id; // Người gửi bây giờ là người nhận C
                const toUserId = originalInbox.from;   // Người nhận bây giờ là người gửi gốc A
                const bodyText = extractPlainTextFromQuill(recipient.autoReplyBody)
                // Tạo một email mới (auto-reply)
                // Lưu ý: Đây là một email hoàn toàn mới, không liên quan transaction cũ
                const autoReplyInbox = await db.Inbox.create({
                    from: fromUserId,
                    parentInboxId: originalInbox.id, // Liên kết với email gốc
                    subject: recipient.autoReplySubject || `Re: [Auto-Reply] ${originalInbox.subject}`,
                    body: recipient.autoReplyBody,
                    bodyText: bodyText,
                    isSent: true
                });

                // Tạo status cho người nhận email auto-reply (là người gửi A)
                await db.InboxUserStatus.create({
                    inboxId: autoReplyInbox.id,
                    userId: toUserId,
                    recipientType: 'to'
                });

                console.log(`Đã gửi auto-reply từ ${fromUserId} đến ${toUserId}`);
            }
        }
        console.log('Hoàn tất xử lý trả lời tự động.');
    } catch (err) {
        // Ghi lại lỗi nhưng không làm sập tiến trình chính
        console.error('Lỗi trong quá trình xử lý trả lời tự động:', err);
    }
}


module.exports = InboxController