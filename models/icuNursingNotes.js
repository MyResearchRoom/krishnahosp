"use strict";

module.exports = (sequelize, DataTypes) => {
  const ICUNursingNote = sequelize.define(
    "ICUNursingNote",
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
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      noteDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      noteTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      nurseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientCondition: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      observations: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      nursingIntervention: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      patientResponse: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      additionalNotes: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
    },
    {
      tableName: "icu_nursing_notes",
      timestamps: true,
    }
  );

  ICUNursingNote.associate = (models) => {
    ICUNursingNote.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });

    ICUNursingNote.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    ICUNursingNote.belongsTo(models.Receptionist, {
      foreignKey: "nurseId",
      as: "nurse",
    });
  };

  return ICUNursingNote;
};