"use strict";

module.exports = (sequelize, DataTypes) => {
  const Bed = sequelize.define(
    "Bed",
    {
      bedCode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bedType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      pricePerDay: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM(
          "available",
          "occupied",
          "maintenance",
          "discharged"
        ),
        allowNull: false,
        defaultValue: "available",
      },
    },
    {
      tableName: "beds",
    }
  );

  Bed.associate = (models) => {
    Bed.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });

    Bed.belongsTo(models.Ward, {
      foreignKey: "wardId",
      as: "ward",
    });

    Bed.belongsTo(models.Room, {
      foreignKey: "roomId",
      as: "room",
    });

    Bed.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
  };

  return Bed;
};
