const db = require('../models');


const InboxController = {

    //Get all inboxes
    async getInboxes(req, res) {
        try {
            const userId = req.params.userId;
            const inbox = await db.Inbox.findAll({
            where: { to: userId },
            include: [
                { model: db.User, as: 'FromUser' },  // Include the sender info
                { model: db.Inbox, as: 'Replies' },
                { model: db.UserLabel, as: 'labels' }   // Include replies if any
            ]
        });

        if (inbox.length === 0) {
            return res.status(404).json({ message: "No inbox messages found for this user" });
        }
        

        res.status(200).json(inbox);

        

        } catch(err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching inbox' });
        }
        
    },

    //sendInbox
    async sendInbox(req, res) {
        try {
            const fromUserId = req.user.id;

            const {phoneNumber, subject, body, attachments} = req.params ;
            
            const userId = await db.User.findOne({
                where : {phoneNumber}
            })

            if (!userId) {
                res.status(404).json({message : 'Failed sending message : User not found'});
            }

            const newInbox = await db.Inbox.create({
                from: fromUserId,
                to : userId,
                body: body,
                subject : subject,
                attachments: attachments

            });

            res.status(201).json({ message: 'Message sent', data: newInbox });

        } catch (err) {
            console.log(err);
            res.status(500).json({message : 'Error sending inbox'})
        }
    }

    //uploadAttachments
    // async uploadAttachments(req, res) {

    // }



    //
}


module.exports = InboxController