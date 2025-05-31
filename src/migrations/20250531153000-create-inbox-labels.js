'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('InboxLabels', {
      inboxId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Inboxes', // tên bảng Inbox (chính xác theo DB)
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      labelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'UserLabels', // tên bảng UserLabel
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    // Thêm composite primary key (inboxId + labelId)
    await queryInterface.addConstraint('InboxLabels', {
      fields: ['inboxId', 'labelId'],
      type: 'primary key',
      name: 'PK_InboxLabels_inboxId_labelId',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('InboxLabels');
  }
};
