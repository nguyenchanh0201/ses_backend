'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Inbox extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Inbox.init({
    id: DataTypes.UUID,
    from: DataTypes.UUID,
    to: DataTypes.UUID,
    body: DataTypes.TEXT,
    subject: DataTypes.STRING,
    isSpam: DataTypes.BOOLEAN,
    isStar: DataTypes.BOOLEAN,
    isImportant: DataTypes.BOOLEAN,
    isHidden: DataTypes.BOOLEAN,
    isDraft: DataTypes.BOOLEAN,
    isSent: DataTypes.BOOLEAN,
    isRead: DataTypes.BOOLEAN,
    isDelete: DataTypes.BOOLEAN,
    replies: DataTypes.ARRAY,
    attachments: DataTypes.JSONB
  }, {
    sequelize,
    modelName: 'Inbox',
  });
  return Inbox;
};