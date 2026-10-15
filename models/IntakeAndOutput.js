"use strict";

module.exports = (sequelize, DataTypes) => {
  const IntakeAndOutput = sequelize.define(
    "IntakeAndOutput",
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

      category :{
        type: DataTypes.ENUM("intake","output"),
        allowNull: false,
      },

      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      quantity: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      time: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      remarks: {
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
      tableName: "intake_and_output",
      timestamps: true,
    }
  );

  IntakeAndOutput.associate = (models)=>{
    IntakeAndOutput.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    IntakeAndOutput.belongsTo(models.IPDAdmission, {
      foreignKey: "ipdAdmissionId",
      as: "ipdAdmission",
    });

    IntakeAndOutput.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });
  };

  return IntakeAndOutput;
};