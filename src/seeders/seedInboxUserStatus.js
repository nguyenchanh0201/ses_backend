'use strict';

const db = require('../models');


async function seedInboxUserStatus() {
    try {
        const user1 = await db.User.findOne({ where: { username: 'userone' } });
        const inbox1 = await db.Inbox.findOne({where: {id : '0169c88b-7743-40d0-9f75-6464c61220eb'}});

        const inboxUserStatus1 = await db.InboxUserStatus.create({
            inboxId: inbox1.id ,
            userId : user1.id,
        })

        console.log("Create inboxUserStatus success"); 

    } catch(err) {
        console.log(err);
    } finally {
        await db.sequelize.close();
      }

}



seedInboxUserStatus();