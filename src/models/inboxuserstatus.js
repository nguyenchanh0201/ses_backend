'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InboxUserStatus extends Model {
    static associate(models) {
      // Mỗi trạng thái thuộc về 1 Inbox
      InboxUserStatus.belongsTo(models.Inbox, { foreignKey: 'inboxId' });

      // Mỗi trạng thái thuộc về 1 User
      InboxUserStatus.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }

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
      type: DataTypes.ENUM('to', 'cc', 'bcc'),  
      allowNull: false,
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
    labels: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
  }, {
    sequelize,
    modelName: 'InboxUserStatus',
    tableName: 'InboxUserStatus',
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
