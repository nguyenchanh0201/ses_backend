const db = require('../models');


const InboxController = {
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
        
    }


    // async getInb
}


module.exports = InboxController