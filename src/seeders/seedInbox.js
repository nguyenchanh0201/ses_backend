'use strict';

const db = require('../models'); // Đường dẫn đến thư mục models, điều chỉnh nếu cần

async function seedInbox() {
  try {
    
    const user1 = await db.User.findOne({ where: { username: 'userone' } });
    const user2 = await db.User.findOne({ where: { username: 'usertwo' } });

    if (!user1 || !user2) {
      throw new Error('User1 hoặc User2 không tồn tại trong database');
    }


    // Tạo inbox chính
    const inbox1 = await db.Inbox.create({
      from: user1.id,
      to: user2.id,
      subject: 'Hello User Two',
      body: 'This is the first message.',
      attachments: [
        { fileName: 'file1.pdf', url: 'http://example.com/file1.pdf' }
      ]
    });

    // Tạo reply cho inbox1
    const reply1 = await db.Inbox.create({
      from: user2.id,
      to: user1.id,
      parentInboxId: inbox1.id,
      subject: 'Re: Hello User Two',
      body: 'Thanks for your message.',
      attachments: []
    });

    // Tạo thêm inbox không phải reply
    const inbox2 = await db.Inbox.create({
      from: user2.id,
      to: user1.id,
      subject: 'Another message',
      body: 'This is another message without reply.',
      attachments: null  // hoặc [], tùy bạn muốn mặc định
    });

    console.log('Seeding inbox data completed successfully.');

  } catch (error) {
    console.error('Error seeding inbox data:', error);
  } finally {
    await db.sequelize.close();
  }
}

seedInbox();
