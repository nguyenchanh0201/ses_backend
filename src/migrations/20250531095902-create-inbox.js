'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Inboxes', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },

      from: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      to: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      subject: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      isSpam: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isStar: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isImportant: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isHidden: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isDraft: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isDelete: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      // replies sẽ lưu danh sách id inbox trả lời, có thể tạo bảng riêng hoặc lưu dạng JSON
      // ở đây mình dùng JSON array để lưu danh sách reply inbox IDs
      replies: {
        type: Sequelize.ARRAY(Sequelize.UUID),
        allowNull: true,
      },

      // attachments cũng có thể lưu dưới dạng JSON array hoặc tạo bảng riêng
      attachments: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Inboxes');
  }
};
