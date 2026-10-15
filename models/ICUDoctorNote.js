"use strict";

module.exports = (sequelize, DataTypes) => {
  const ICUDoctorNote = sequelize.define(
    "ICUDoctorNote",
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

      doctorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      subDoctorId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      createdByRole: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      noteDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      noteTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      chiefComplaint: {
        type:DataTypes.TEXT("long"),
        allowNull: true,
      },

      clinicalFindings: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      advice: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      diagnosis: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      treatmentPlan: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      notes: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },

      
    },
    {
      tableName: "icu_doctor_notes",
      timestamps: true,
    }
  );

  ICUDoctorNote.associate = (models)=>{
    ICUDoctorNote.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    ICUDoctorNote.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });

    ICUDoctorNote.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });

    ICUDoctorNote.belongsTo(models.SubDoctor, {
      foreignKey: "subDoctorId",
      as: "subDoctor",
    });
  };


  return ICUDoctorNote;
};