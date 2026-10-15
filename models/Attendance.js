"use strict";

module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    "Attendance",
    {
      checkInTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      checkOutTime: {
        type: DataTypes.DATE,
        allowNull: true, 
      },
      date: {
        type: DataTypes.DATEONLY, 
        allowNull: false,
      },
    },
    {
      tableName: "attendances",
      timestamps: true,
      updatedAt: false, 
    }
  );

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.Receptionist, {
      foreignKey: "receptionistId",
      as: "receptionist",
    });
  };

  return Attendance;
};
