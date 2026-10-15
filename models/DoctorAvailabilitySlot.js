"use strict";

module.exports = (sequelize, DataTypes) => {
  const DoctorAvailabilitySlot = sequelize.define(
    "DoctorAvailabilitySlot",
    {
      slotName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      slotStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      slotEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
    },
    {
      tableName: "doctor_availabilitys",
    }
  );

  DoctorAvailabilitySlot.associate = (models) => {
    DoctorAvailabilitySlot.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
  };

  return DoctorAvailabilitySlot;
};
