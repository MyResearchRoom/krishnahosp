"use strict";

module.exports = (sequelize, DataTypes) => {
  const PatientDocument = sequelize.define(
    "PatientDocument",
    {
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

      admissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      
      documentName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      document: {
        type: DataTypes.BLOB("long"),
        allowNull: false,
      },

      documentMimeType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      
    },
    {
      tableName: "patient_documents",
    }
  );

  PatientDocument.associate = (models) => {
    PatientDocument.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    PatientDocument.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });

  };

  return PatientDocument;
};