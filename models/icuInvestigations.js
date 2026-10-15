"use strict";

module.exports = (sequelize, DataTypes) => {
  const Investigation = sequelize.define(
    "Investigation",
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

      investigationName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      result: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      document: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },

      documentMimeType: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      investigationDate: {
        type: DataTypes.DATE,
        allowNull: false,
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
      tableName: "investigations",
      timestamps: true,
    }
  );

  Investigation.associate = (models) => {
    Investigation.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    Investigation.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });
  };

  return Investigation;
};