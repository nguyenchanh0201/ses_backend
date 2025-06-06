'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InboxUserStatusLabel extends Model {
    static associate(models) {
      // Định nghĩa các mối quan hệ nếu cần, mặc dù bảng trung gian thường không cần
      // Ví dụ:
      // InboxUserStatusLabel.belongsTo(models.InboxUserStatus, { foreignKey: 'inboxUserStatusId' });
      // InboxUserStatusLabel.belongsTo(models.UserLabel, { foreignKey: 'userLabelId' });
    }
  }

  InboxUserStatusLabel.init({
    inboxUserStatusId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'InboxUserStatuses', // Tên bảng trong database
        key: 'id'
      }
    },
    userLabelId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'UserLabels', // Tên bảng trong database
        key: 'id'
      }
    },
  }, {
    sequelize,
    modelName: 'InboxUserStatusLabel',
    tableName: 'InboxUserStatusLabels', // Tên bảng sẽ được tạo trong DB
    timestamps: true, // Thường là true để biết khi nào nhãn được gắn
  });

  return InboxUserStatusLabel;
};