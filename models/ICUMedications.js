"use strict";

module.exports = (sequelize, DataTypes) => {
  const ICUMedication = sequelize.define(
    "ICUMedication",
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
        allowNull: false,
      },

      medicineName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      dose: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      route: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      frequency: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      createdBy: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      createdByRole: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM(
          "ACTIVE",
          "STOPPED",
          "COMPLETED",
          "CANCELLED"
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      instructions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "icu_medications",
      timestamps: true,
    }
  );

    ICUMedication.associate = (models)=>{
        ICUMedication.belongsTo(models.Patient, {
          foreignKey: "patientId",
          as: "patient",
        });

        ICUMedication.belongsTo(models.ICUAdmission, {
          foreignKey: "icuAdmissionId",
          as: "icuAdmission",
        });


    };

  return ICUMedication;
};