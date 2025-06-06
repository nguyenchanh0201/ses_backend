const db = require('../models');
const { uploadFileToS3 } = require('../utils/uploadFileS3');
const { v4: uuidv4 } = require("uuid");


const InboxController = {

    //Get all inboxes
    async getInboxes(req, res) {
        try {

            const userId = req.user.id;

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const offset = (page - 1) * limit;


            const statusFields = ['isRead', 'isStarred', 'isSpam', 'isDeleted'];
            const statusWhere = { userId };
            let actualStatusParamsFound = false;

            for (const definedField of statusFields) {
                let queryValue;

                if (req.query[definedField] !== undefined) {
                    queryValue = req.query[definedField];
                }

                else if (req.query[definedField.toLowerCase()] !== undefined) {
                    queryValue = req.query[definedField.toLowerCase()];
                }

                if (queryValue !== undefined) {
                    const val = String(queryValue).toLowerCase();
                    if (val === 'true' || val === 'false') {
                        statusWhere[definedField] = (val === 'true');
                        actualStatusParamsFound = true;
                    }
                }
            }

            const hasStatusFilter = actualStatusParamsFound;

            let labelFilter = req.query.label;
            if (labelFilter && typeof labelFilter === 'string') {
                labelFilter = [labelFilter];
            }

            // --- Include Options for Sequelize ---
            const includeStatus = {
                model: db.InboxUserStatus,
                as: 'status',
                where: statusWhere,
                required: hasStatusFilter,
            };

            const includeLabels = {
                model: db.UserLabel,
                as: 'labels',

                required: !!labelFilter,
            };

            if (labelFilter) {
                includeLabels.where = {
                    labelName: labelFilter.length === 1
                        ? labelFilter[0]
                        : { [db.Sequelize.Op.in]: labelFilter }
                };
            }

            // --- Database Query ---
            const { count, rows } = await db.Inbox.findAndCountAll({
                where: { to: userId },
                include: [
                    { model: db.User, as: 'FromUser' },
                    { model: db.Inbox, as: 'Replies' },
                    includeLabels,
                    includeStatus,
                ],
                order: [[sortBy, sortOrder]],
                limit,
                offset,
                distinct: true,
            });

            if (rows.length === 0) {
                return res.status(404).json({ message: "No inbox messages found for this user with the specified criteria." });
            }

            res.status(200).json({ count, inbox: rows });

        } catch (err) {
            console.error('Error fetching inbox:', err);
            res.status(500).json({ message: 'Error fetching inbox' });
        }
    },


    //sendInbox
    async sendInbox(req, res) {
        try {
            const fromUserId = req.user.id;
            const { phoneNumbers, cc, bcc, subject, body, attachments, parentInboxId, isSent } = req.body;

            // Kiểm tra mảng phoneNumbers có chứa ít nhất một số điện thoại
            if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
                return res.status(400).json({ message: 'phoneNumbers must be a non-empty array' });
            }

            // Combine phone numbers from cc, bcc, and phoneNumbers (to)
            const allPhoneNumbers = [...cc, ...bcc, ...phoneNumbers];
            const uniquePhoneNumbers = Array.from(new Set(allPhoneNumbers)); // Deduplicate phone numbers

            const users = await db.User.findAll({
                where: { phoneNumber: uniquePhoneNumbers }
            });

            // Map the users to their corresponding UUIDs
            const userMap = users.reduce((acc, user) => {
                acc[user.phoneNumber] = user.id;
                return acc;
            }, {});

            // Map each list to UUIDs
            const ccUUIDs = cc.map(phone => userMap[phone] || null);
            const bccUUIDs = bcc.map(phone => userMap[phone] || null);
            const toUUIDs = phoneNumbers.map(phone => userMap[phone] || null);

            // Check if any recipient UUIDs are missing
            const missingUsers = [];
            if (toUUIDs.some(id => !id)) missingUsers.push(...phoneNumbers);
            if (ccUUIDs.some(id => !id)) missingUsers.push(...cc);
            if (bccUUIDs.some(id => !id)) missingUsers.push(...bcc);

            if (missingUsers.length > 0) {
                return res.status(400).json({
                    message: 'Some users not found in the database',
                    missingUsers
                });
            }

            // Prepare messages and errors
            const sentMessages = [];
            const errors = [];

            const t = await db.sequelize.transaction(); // Start transaction

            try {
                // Lặp qua mảng phoneNumbers (to) để gửi message cho từng số điện thoại
                for (const userId of toUUIDs) {
                    try {
                        // Create a new inbox message
                        const newInbox = await db.Inbox.create({
                            from: fromUserId,
                            to: userId,
                            parentInboxId: parentInboxId,
                            body: body,
                            subject: subject,
                            attachments: attachments,
                        }, { transaction: t });

                        if (!newInbox) {
                            errors.push({ userId, message: 'Failed creating inbox' });
                            continue;
                        }

                        // If the message is sent, create InboxUserStatus entries for the sender and recipients
                        if (isSent) {
                            const createStatuses = [];

                            // Create status for the sender
                            createStatuses.push(
                                db.InboxUserStatus.create({
                                    inboxId: newInbox.id,
                                    userId: fromUserId
                                }, { transaction: t })
                            );

                            // Create status for the main recipient (to)
                            createStatuses.push(
                                db.InboxUserStatus.create({
                                    inboxId: newInbox.id,
                                    userId: userId,
                                    recipientType: 'to'
                                }, { transaction: t })
                            );

                            // Create status for cc recipients
                            ccUUIDs.forEach(ccUserId => {
                                if (ccUserId) {
                                    createStatuses.push(
                                        db.InboxUserStatus.create({
                                            inboxId: newInbox.id,
                                            userId: ccUserId,
                                            recipientType: 'cc'
                                        }, { transaction: t })
                                    );
                                }
                            });

                            // Create status for bcc recipients
                            bccUUIDs.forEach(bccUserId => {
                                if (bccUserId) {
                                    createStatuses.push(
                                        db.InboxUserStatus.create({
                                            inboxId: newInbox.id,
                                            userId: bccUserId,
                                            recipientType: 'bcc'
                                        }, { transaction: t })
                                    );
                                }
                            });

                            // Wait for all statuses to be created
                            await Promise.all(createStatuses);
                        } else {
                            //Tạo draft mới ở đây

                        }

                        // Add the new inbox to the successful messages
                        sentMessages.push(newInbox);

                    } catch (err) {
                        console.error(err);
                        errors.push({ userId, message: `Error processing this user: ${err.message}` });
                    }
                }

                // Commit the transaction if all inboxes are successfully created
                await t.commit();

                // If there were errors, return the error details
                if (errors.length > 0) {
                    return res.status(400).json({
                        message: 'Some users not found or error occurred',
                        errors
                    });
                }

                // Return success response
                res.status(201).json({
                    message: 'Messages sent successfully',
                    data: {
                        success: sentMessages,
                        errors: errors
                    }
                });

            } catch (err) {
                // Rollback the transaction in case of error
                await t.rollback();
                console.error(err);
                res.status(500).json({ message: 'Error sending inbox' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error processing the request' });
        }
    },




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

    //Get sent inboxes

}


module.exports = InboxController