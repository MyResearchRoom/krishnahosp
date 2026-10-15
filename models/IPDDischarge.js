"use strict";

module.exports = (sequelize, DataTypes) => {
  const IPDDischarge = sequelize.define(
    "IPDDischarge",
    {
      dischargeId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      dischargeNote: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      dischargeInitiateDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      dischargeDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      dischargeTime: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      dischargeType: {
        type: DataTypes.ENUM(
          "Normal",
          "LAMA",
          "DAMA",
          "Transfer",
          "Death",
          "Other"
        ),
        allowNull: false,
        defaultValue: "Normal",
      },

      dischargeCondition: {
        type: DataTypes.ENUM(
          "Stable",
          "Improved",
          "Unchanged",
          "Critical",
          "Expired"
        ),
        allowNull: true,
        defaultValue:"Stable",
      },

      followUpDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      followUpInstructions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      finalBill: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      status: {
        type: DataTypes.ENUM(
          "Initiated",
          "Pending",
          "Discharged",
          "Cancelled"
        ),
        allowNull: false,
        defaultValue: "Initiated",
      },

      admissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      }
    },
    {
      tableName: "ipd_discharges",
    }
  );

  IPDDischarge.associate = (models) => {

    IPDDischarge.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });

    IPDDischarge.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
  };

  return IPDDischarge;
};
