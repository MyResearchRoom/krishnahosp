const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DoctorTimeSlot extends Model {
    static associate(models) {
      DoctorTimeSlot.belongsTo(models.Doctor, {
        foreignKey: "doctorId",
        as: "doctor",
      });
      DoctorTimeSlot.belongsTo(models.SubDoctor, {
        foreignKey: "subDoctorId",
        as: "subDoctor",
      });
    }
  }

  DoctorTimeSlot.init(
    {
      doctorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      subDoctorId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      slotName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      maxCapacity: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      availabilityIds: {
        type: DataTypes.JSON, // store like [1,2,3] → Mon, Tue, Wed
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "DoctorTimeSlot",
      tableName: "doctor_time_slots",
      timestamps: true,
    }
  );

  return DoctorTimeSlot;
};
