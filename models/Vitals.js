"use strict";

module.exports = (sequelize, DataTypes) => {
  const Vitals = sequelize.define(
    "Vitals",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      ipdAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      icuAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientUniqueId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      recordedAtDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      recordedAtTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      temperature: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },

      pulse: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      bp :{
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      insulin :{
        type: DataTypes.STRING,
        allowNull: true,
      },

      spo2: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },

      bsl: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
      },

      respiratoryRate: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      recordedBy: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      recordedByRole: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    },
    {
      tableName: "vitals",
      timestamps: true,
    }
  );

  Vitals.associate = (models)=>{
    Vitals.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    Vitals.belongsTo(models.IPDAdmission, {
      foreignKey: "ipdAdmissionId",
      as: "ipdAdmission",
    });

    Vitals.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });
  };

  return Vitals;
};