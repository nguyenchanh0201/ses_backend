const db = require('../models');
const { extractPlainTextFromQuill } = require('../utils/getPlainBody');
const { uploadFileToS3 } = require('../utils/uploadFileS3');
const { v4: uuidv4 } = require("uuid");
const { Op, QueryTypes } = db.Sequelize;

const InboxController = {


    async getInboxes(req, res) {
    try {
        const userId = req.user.id;

        // --- BƯỚC 1: XỬ LÝ CÁC THAM SỐ ĐẦU VÀO ---
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const category = req.query.category?.toLowerCase() || 'inbox';
        const labelName = req.query.label; // Hỗ trợ lọc theo tên nhãn
        const keywords = req.query.keywords?.trim();
        const { startDate, endDate, isRead, isStarred, isImportant } = req.query;
        
        const defaultSortBy = category === 'draft' ? 'updatedAt' : 'createdAt';
        const sortBy = req.query.sortBy || defaultSortBy;
        const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase();

        let count, rows;

        // --- BƯỚC 2: XỬ LÝ LOGIC DỰA TRÊN VIỆC LỌC THEO NHÃN HAY THEO CATEGORY ---

        // Xây dựng các object điều kiện và include
        const inboxWhere = {};
        const statusWhere = { userId };
        let isStatusRequired = false;

        const labelInclude = {
            model: db.UserLabel,
            as: 'labels',
            attributes: ['id', 'labelName'],
            through: { attributes: [] },
        };

        // Nếu có lọc theo tên nhãn, ta sẽ thêm điều kiện vào include
        if (labelName) {
            labelInclude.where = { labelName: { [Op.iLike]: labelName } };
            labelInclude.required = true; // INNER JOIN để chỉ lấy tin nhắn CÓ nhãn này
            isStatusRequired = true; // Buộc phải join bảng status để join được bảng label
        }
        
        // Cấu hình include cho status, lồng cả include cho label vào trong
        const statusInclude = {
            model: db.InboxUserStatus,
            as: 'status',
            where: statusWhere,
            include: [labelInclude]
        };

        const fromUserInclude = {
            model: db.User,
            as: 'FromUser',
            attributes: ['id', 'name', 'imageUrl'],
        };
        
        // Luồng chính: Nếu là category 'inbox', áp dụng gom nhóm hội thoại.
        // Nếu lọc theo nhãn hoặc keyword, chúng ta sẽ tìm trên danh sách phẳng.
        if (category === 'inbox' && !labelName && !keywords) {
            
            // --- LOGIC GOM NHÓM HỘI THOẠI (Chỉ áp dụng cho category 'inbox' mặc định) ---

            // 2A. Dùng SQL đệ quy để tìm ID của các tin nhắn mới nhất trong mỗi chuỗi hội thoại
            const latestMessagesQuery = `
                WITH RECURSIVE ConversationRoot AS (
                    -- Phần neo: những tin nhắn là gốc của chính nó (không có parent)
                    SELECT id, id as "rootId"
                    FROM "${db.Inbox.tableName}"
                    WHERE "parentInboxId" IS NULL
                    
                    UNION ALL
                    
                    -- Phần đệ quy: tìm các tin nhắn con và gán "rootId" của cha cho nó
                    SELECT i.id, r."rootId"
                    FROM "${db.Inbox.tableName}" i
                    INNER JOIN ConversationRoot r ON i."parentInboxId" = r.id
                ),
                RankedMessages AS (
                    SELECT
                        i.id,
                        -- Gom nhóm theo "rootId" vừa tìm được ở trên
                        ROW_NUMBER() OVER(PARTITION BY cr."rootId" ORDER BY i."createdAt" DESC) as rn
                    FROM "${db.Inbox.tableName}" i
                    INNER JOIN "${db.InboxUserStatus.tableName}" s ON i.id = s."inboxId"
                    INNER JOIN ConversationRoot cr ON i.id = cr.id -- Join để lấy rootId
                    WHERE
                        s."userId" = :userId
                        AND s."recipientType" IS NOT NULL
                        AND s."isDeleted" = false
                        AND s."isSpam" = false
                        AND i."isSent" = true
                )
                SELECT id FROM RankedMessages WHERE rn = 1;
            `; // Câu lệnh SQL đệ quy dài của bạn ở đây
            const latestMessages = await db.sequelize.query(latestMessagesQuery, {
                replacements: { userId },
                type: QueryTypes.SELECT,
            });
            const latestMessageIds = latestMessages.map(msg => msg.id);

            if (latestMessageIds.length === 0) {
                return res.status(200).json({ totalPages: 0, currentPage: 1, totalMessages: 0, inbox: [] });
            }

            // Lọc chính là các ID đã tìm được
            inboxWhere.id = { [Op.in]: latestMessageIds };
            statusInclude.required = true; // Luôn cần status cho inbox

        } else {
            // --- LOGIC LỌC PHẲNG (Áp dụng cho các category khác, hoặc khi có bộ lọc label/keywords) ---

            // 2B. Xây dựng điều kiện lọc dựa trên category
            statusInclude.where.isDeleted = false; // Mặc định không lấy tin trong thùng rác
            
            switch (category) {
                case 'sent':
                    inboxWhere.from = userId;
                    inboxWhere.isSent = true;
                    statusInclude.required = false; // Thư gửi đi có thể không có status cho chính mình
                    break;
                case 'draft':
                    inboxWhere.from = userId;
                    inboxWhere.isSent = false;
                    statusInclude.required = false;
                    break;
                case 'starred':
                    statusInclude.where.isStarred = true;
                    isStatusRequired = true;
                    break;
                // ... các case khác như 'trash', 'spam', 'important'
                default: // 'inbox'
                    statusInclude.where.isSpam = false;
                    inboxWhere.isSent = true;
                    isStatusRequired = true;
                    break;
            }
        }

        // --- BƯỚC 3: ÁP DỤNG CÁC BỘ LỌC NÂNG CAO (keywords, date, status) ---
        
        if (keywords) {
            const searchTerm = `%${keywords}%`;
            inboxWhere[Op.or] = [
                { subject: { [Op.iLike]: searchTerm } },
                { bodyText: { [Op.iLike]: searchTerm } },
                { '$FromUser.name$': { [Op.iLike]: searchTerm } }
            ];
            fromUserInclude.required = true; // INNER JOIN khi tìm theo tên người gửi
        }

        if (isRead !== undefined) statusWhere.isRead = (isRead === 'true');
        if (isStarred !== undefined) statusWhere.isStarred = (isStarred === 'true');
        if (isImportant !== undefined) statusWhere.isImportant = (isImportant === 'true');

        if (startDate || endDate) {
            inboxWhere.createdAt = {};
            if (startDate) inboxWhere.createdAt[Op.gte] = new Date(startDate);
            if (endDate) inboxWhere.createdAt[Op.lte] = new Date(endDate);
        }

        // Cập nhật lại required cho statusInclude sau khi đã xử lý tất cả logic
        statusInclude.required = isStatusRequired || !!labelName;


        // --- BƯỚC 4: THỰC THI TRUY VẤN CUỐI CÙNG ---

        ({ count, rows } = await db.Inbox.findAndCountAll({
            where: inboxWhere,
            include: [fromUserInclude, statusInclude],
            order: [[sortBy, sortOrder]],
            limit,
            offset,
            distinct: true,
            // SỬA LẠI: Trả về object attachments đầy đủ để nhất quán với API getById
            attributes: {
                exclude: ['body'], 
            },
        }));

        // --- BƯỚC 5: TRẢ VỀ KẾT QUẢ ---
        return res.status(200).json({
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalMessages: count,
            inbox: rows,
        });

    } catch (err) {
        console.error('Error fetching inboxes:', err);
        return res.status(500).json({ message: 'Error fetching inboxes', error: err.message });
    }
},



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
                        to: phoneNumbers,
                        cc: cc,
                        bcc: bcc
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
                    const statusesToCreate = [];

                    // 2. Thêm status cho NGƯỜI GỬI
                    statusesToCreate.push({
                        inboxId: newInbox.id,
                        userId: fromUserId,
                        recipientType: null,
                        isRead: true
                    });

                    // 3. Tạo map để xử lý người nhận, tránh trùng lặp
                    const recipientMap = new Map();
                    const addRecipientStatus = (userId, type) => {
                        // Ưu tiên 'to' > 'cc' > 'bcc'. Nếu user đã có trong map thì không ghi đè.
                        if (userId && !recipientMap.has(userId)) {
                            recipientMap.set(userId, type);
                        }
                    };

                    // Giữ nguyên logic thêm người nhận
                    toUUIDs.forEach(userId => addRecipientStatus(userId, 'to'));
                    ccUUIDs.forEach(userId => addRecipientStatus(userId, 'cc'));
                    bccUUIDs.forEach(userId => addRecipientStatus(userId, 'bcc'));

                    // 4. Thêm status của những người nhận vào mảng chính
                    for (const [userId, type] of recipientMap.entries()) {
                        statusesToCreate.push({
                            inboxId: newInbox.id,
                            userId: userId,
                            recipientType: type
                        });
                    }

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
            const userId = req.user.id;

            // --- BƯỚC 0: KIỂM TRA QUYỀN TRUY CẬP BAN ĐẦU ---
            const permissionCheck = await db.InboxUserStatus.findOne({ where: { inboxId, userId } });
            if (!permissionCheck) {
                return res.status(404).json({ message: "Inbox not found or you don't have permission to view it." });
            }

            // --- BƯỚC 1: TÌM ID GỐC RỄ CỦA CUỘC HỘI THOẠI (ROOT ID) ---
            let currentId = inboxId;
            let rootId = inboxId;

            // Dùng vòng lặp để đi ngược lên đến tin nhắn gốc nhất
            while (currentId) {
                const currentInbox = await db.Inbox.findOne({
                    where: { id: currentId },
                    attributes: ['id', 'parentInboxId'],
                });

                if (currentInbox && currentInbox.parentInboxId) {
                    currentId = currentInbox.parentInboxId;
                    rootId = currentInbox.parentInboxId; // Cập nhật rootId mỗi lần đi lên
                } else {
                    // Đã đến tin nhắn gốc (không có parent) hoặc không tìm thấy
                    break;
                }
            }

            // --- BƯỚC 2: DÙNG TRUY VẤN ĐỆ QUY ĐỂ LẤY ID CỦA TẤT CẢ TIN NHẮN TRONG CHUỖI ---
            const recursiveQuery = `
            WITH RECURSIVE ConversationThread AS (
                -- 1. Phần neo: Bắt đầu với tin nhắn gốc
                SELECT id
                FROM "Inboxes"
                WHERE id = :rootId

                UNION ALL

                -- 2. Phần đệ quy: Tìm tất cả các tin nhắn trả lời của các tin đã có trong danh sách
                SELECT i.id
                FROM "Inboxes" i
                INNER JOIN ConversationThread ct ON i."parentInboxId" = ct.id
            )
            SELECT id FROM ConversationThread;
        `;

            const threadIdsResult = await db.sequelize.query(recursiveQuery, {
                replacements: { rootId: rootId },
                type: QueryTypes.SELECT,
            });

            // Lấy danh sách ID từ kết quả truy vấn
            const threadIds = threadIdsResult.map(item => item.id);


            // --- BƯỚC 3: LẤY ĐẦY ĐỦ DỮ LIỆU CHO CÁC TIN NHẮN BẰNG SEQUELIZE FINDALL ---
            const conversation = await db.Inbox.findAll({
                where: {
                    id: { [Op.in]: threadIds }
                    // Lấy tất cả tin nhắn có ID nằm trong danh sách đã tìm được
                },
                order: [['createdAt', 'ASC']], // Luôn sắp xếp để hiển thị đúng thứ tự
                attributes: {
                    
                    include: [
                        [
                            db.Sequelize.literal(`(SELECT jsonb_agg(elem->>'fileName') FROM jsonb_array_elements("Inbox"."attachments") AS elem)`),
                            'attachmentFileNames'
                        ],
                        'bodyText'
                    ]
                },
                include: [
                    {
                        model: db.InboxUserStatus,
                        as: 'status',
                        where: { userId: userId },
                        required: false, // Dùng LEFT JOIN
                        attributes: ['isRead', 'isStarred', 'isSpam', 'isDeleted', 'isImportant']
                    },
                    {
                        model: db.User,
                        as: 'FromUser',
                        attributes: ['id', 'name', 'imageUrl', 'phoneNumber'],
                    }
                ]
            });

            const filteredConversation = conversation.filter(msg => {
                // Điều kiện 1: User phải có quyền truy cập cơ bản vào tin nhắn này
                const hasPermission = msg.dataValues.status != null;
                if (!hasPermission) {
                    return false;
                }

                // Điều kiện 2: Tin nhắn được hiển thị nếu:
                // a) Nó đã được gửi (isSent: true)
                // b) HOẶC nó là thư nháp (isSent: false) VÀ người dùng hiện tại là người gửi
                const isVisible = msg.isSent || (!msg.isSent && msg.FromUser?.id === userId);

                return isVisible;
            });


            return res.status(200).json(filteredConversation);


        } catch (err) {
            console.error('Error getting inbox conversation:', err);
            return res.status(500).json({ message: 'Error getting inbox conversation', error: err.message });
        }
    },


    //Update inbox status 
    async updateInboxStatus(req, res) {
        try {
            const { inboxId } = req.params;
            const userId = req.user.id;

            const updates = req.body;

            const allowedUpdates = ['isRead', 'isStarred', 'isSpam', 'isDeleted', 'isImportant'];

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
                // const allPhoneNumbers = [...new Set([...(phoneNumbers || []), ...(cc || []), ...(bcc || [])])];
                // const users = await db.User.findAll({ where: { phoneNumber: allPhoneNumbers } });
                // const userMap = users.reduce((acc, user) => { acc[user.phoneNumber] = user.id; return acc; }, {});
                // const toUUIDs = (phoneNumbers || []).map(phone => userMap[phone]).filter(Boolean);
                // const ccUUIDs = (cc || []).map(phone => userMap[phone]).filter(Boolean);
                // const bccUUIDs = (bcc || []).map(phone => userMap[phone]).filter(Boolean);

                await draft.update({
                    subject: subject,
                    body: body,
                    bodyText: bodyText,
                    attachments: attachments,
                    draft: { // Cập nhật lại thông tin người nhận trong draft
                        to: phoneNumbers,
                        cc: cc,
                        bcc: bcc
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