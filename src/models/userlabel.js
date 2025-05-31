'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserLabel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  UserLabel.init({
    id: DataTypes.UUID,
    userId: DataTypes.UUID,
    labelName: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'UserLabel',
  });
  return UserLabel;
};