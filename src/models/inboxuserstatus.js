// models/inboxuserstatus.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InboxUserStatus extends Model {
    static associate(models) {
      // Giữ nguyên các association này, chúng đã đúng
      InboxUserStatus.belongsTo(models.Inbox, { foreignKey: 'inboxId' });
      InboxUserStatus.belongsTo(models.User, { foreignKey: 'userId' });
      InboxUserStatus.belongsToMany(models.UserLabel, {
        through: 'InboxUserStatusLabel',
        foreignKey: 'inboxUserStatusId',
        as: 'labels'
      });
    }
  }

  // Sửa đổi phần init
  InboxUserStatus.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    inboxId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    recipientType: { 
      type: DataTypes.ENUM('to', 'cc', 'bcc'), // Sẽ cần sửa một chút ở đây, xem bên dưới 
      allowNull: true,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isStarred: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isSpam: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

  }, {
    sequelize,
    modelName: 'InboxUserStatus',
    tableName: 'InboxUserStatus', // Tên bảng nên là số nhiều 'InboxUserStatuses' theo quy ước
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['inboxId', 'userId'],
        name: 'unique_inbox_user'
      }
    ]
  });

  return InboxUserStatus;
};