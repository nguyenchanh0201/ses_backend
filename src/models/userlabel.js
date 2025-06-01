'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserLabel extends Model {
    static associate(models) {
      // UserLabel thuộc về 1 User
      UserLabel.belongsTo(models.User, { foreignKey: 'userId' });



      UserLabel.belongsToMany(models.Inbox, {
        through: models.InboxLabel,
        foreignKey: 'labelId',
        as: 'inboxes',
      });

    }
  }
  UserLabel.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    labelName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'UserLabel',
    tableName: 'UserLabels',
    timestamps: true,
  });
  return UserLabel;
};
