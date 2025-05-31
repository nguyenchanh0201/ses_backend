'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init({
    id: DataTypes.UUID,
    phoneNumber: DataTypes.STRING,
    name: DataTypes.STRING,
    password: DataTypes.STRING,
    username: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    gender: DataTypes.STRING,
    dOfB: DataTypes.DATE,
    isVerified: DataTypes.BOOLEAN,
    imageUrl: DataTypes.STRING,
    isAutoReply: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};