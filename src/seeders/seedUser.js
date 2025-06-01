'use strict';

const db = require('../models'); // Điều chỉnh đường dẫn tới thư mục models nếu cần

async function seedUsers() {
  try {
    const [user1, created1] = await db.User.findOrCreate({
      where: { username: 'userone' },
      defaults: {
        name: 'User One',
        phoneNumber: '0123456789',
        password: 'password1',   // Nếu bạn có mã hóa password bằng hook, nó sẽ tự mã hóa
        username: 'userone',
        gender: 'male',
        dOfB: new Date('1990-01-01'),
        isVerified: true,
        imageUrl: 'https://example.com/avatar1.png',
        isAutoReply: false,
      }
    });

    const [user2, created2] = await db.User.findOrCreate({
      where: { username: 'usertwo' },
      defaults: {
        name: 'User Two',
        phoneNumber: '0987654321',
        password: 'password2',
        username: 'usertwo',
        gender: 'female',
        dOfB: new Date('1992-02-02'),
        isVerified: false,
        imageUrl: 'https://example.com/avatar2.png',
        isAutoReply: true,
      }
    });

    console.log('Users seeded:', user1.username, user2.username);
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await db.sequelize.close();
  }
}

seedUsers();
