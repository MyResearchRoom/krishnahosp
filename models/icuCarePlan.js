"use strict";

module.exports = (sequelize, DataTypes) => {
  const ICUCarePlan = sequelize.define(
    "ICUCarePlan",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      icuAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientUniqueId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      problem: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },

      goal: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },

      intervention: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },

      frequency: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      assignedNurseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      reviewDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM(
          "ACTIVE",
          "COMPLETED",
          "CANCELLED",
          "INPROCESS",
          "OVER_DUE",
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      
      createdBy: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      createdByRole: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      tableName: "icu_care_plan",
      timestamps: true,
    }
  );

  ICUCarePlan.associate = (models) => {
    ICUCarePlan.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });

    ICUCarePlan.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    ICUCarePlan.belongsTo(models.Receptionist, {
      foreignKey: "assignedNurseId",
      as: "assignedNurse",
    });
  };

  return ICUCarePlan;
};