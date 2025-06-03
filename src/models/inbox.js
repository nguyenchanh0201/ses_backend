'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Inbox extends Model {
    static associate(models) {

      Inbox.belongsTo(models.User, { as: 'FromUser', foreignKey: 'from' });
      Inbox.belongsTo(models.User, { as: 'ToUser', foreignKey: 'to' });


      Inbox.hasMany(models.Inbox, { as: 'Replies', foreignKey: 'parentInboxId' });


      Inbox.hasMany(models.InboxUserStatus, { foreignKey: 'inboxId', as: 'status' });

      Inbox.belongsToMany(models.UserLabel, {
        through: models.InboxLabel,  // The junction table (InboxLabels)
        foreignKey: 'inboxId',
        as: 'labels',  // Alias for labels associated with this inbox
      });
    
  }
}
Inbox.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  from: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  to: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  parentInboxId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  body: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },
}, {
  sequelize,
  modelName: 'Inbox',
  tableName: 'Inboxes',
  timestamps: true,
});
return Inbox;
};
