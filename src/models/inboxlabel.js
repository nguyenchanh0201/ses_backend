'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InboxLabel extends Model {
    static associate(models) {
      InboxLabel.belongsTo(models.Inbox, { foreignKey: 'inboxId', as: 'inbox' });
      InboxLabel.belongsTo(models.UserLabel, { foreignKey: 'labelId', as: 'userLabel' });
    }
  }

  InboxLabel.init({
    inboxId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,  // Sequelize không hoàn toàn hỗ trợ composite PK, nhưng khai báo tạm thế này
    },
    labelId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
  }, {
    sequelize,
    modelName: 'InboxLabel',
    tableName: 'InboxLabels',
    timestamps: true,
  });

  return InboxLabel;
};
