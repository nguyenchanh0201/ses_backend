const db = require('../models');


const InboxController = {

    //Get all inboxes
     async getInboxes(req, res) {
        try {
        
        const userId = '7d270820-b3f5-4eb9-8a9e-6b26c0517999'; 

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
            // const fromUserId = '82577838-48da-45b8-981d-2b5383f0d11a';

            const { phoneNumber, subject, body, attachments, parentInboxId } = req.body;

            const userTo = await db.User.findOne({
                where: { phoneNumber }
            })

            const userId = userTo.id;
            console.log(userId)

            if (!userId) {
                res.status(404).json({ message: 'Failed sending message : User not found' });
            }
            else if (userId === fromUserId) {
                res.status(400).json({ message: 'Can not send to yourself' })
            }

            const newInbox = await db.Inbox.create({
                from: fromUserId,
                to: userId,
                parentInboxId: parentInboxId,
                body: body,
                subject: subject,
                attachments: attachments

            });

            if (!newInbox) {
                res.status(500).json({ message: 'Failed creating inbox' })

            }




            //Create new status for each user
            const newStatusFrom = await db.InboxUserStatus.create({
                inboxId: newInbox.id,
                userId: fromUserId

            })

            if (!newStatusFrom) {
                res.status(500).json({ message: 'Failed create inboxs status from' })
            }

            const newStatusTo = await db.InboxUserStatus.create({
                inboxId: newInbox.id,
                userId: userId
            })

            if (!newStatusTo) {
                res.status(500).json({ message: 'Failed create inboxs status to' })
            }


            res.status(201).json({ message: 'Message sent', data: newInbox });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: 'Error sending inbox' })
        }
    },

    //uploadAttachments

    // async uploadAttachments(req, res) {

    // }

    //Get sent inboxes

}


module.exports = InboxController