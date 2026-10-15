"use strict";

module.exports = (sequelize, DataTypes) => {
  const ICUProcedure = sequelize.define(
    "ICUProcedure",
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

      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientUniqueId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      icuAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      procedureName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      procedureDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      procedureTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      preProcedureNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      indication: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      complications: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },

      postProcedureCondition: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      createdBy: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      createdByRole: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName: "icu_procedures",
      timestamps: true,
    }
  );

  ICUProcedure.associate = (models) => {
    ICUProcedure.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    ICUProcedure.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });
  };

  return ICUProcedure;
};