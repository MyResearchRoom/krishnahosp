"use strict";

module.exports = (sequelize, DataTypes) => {
  const ICUAdmission = sequelize.define(
    "ICUAdmission",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      icuAdmissionNumber: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
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

      ipdAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      wardId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      roomId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      bedId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      admissionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      admissionTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      admissionType: {
        type: DataTypes.ENUM(
          "DIRECT",
          "EMERGENCY",
          "PLANNED",
          "POST_OPERATIVE",
          "TRANSFER_FROM_IPD",
          "TRANSFER_FROM_OTHER_HOSPITAL"
        ),
        allowNull: false,
        defaultValue: "TRANSFER_FROM_IPD",
      },

      admissionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      clinicalStatus: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      attendingDoctorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      attendingSubDoctorId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      admissionNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM(
          "ACTIVE",
          "TRANSFERRED",
          "DISCHARGED",
          "CANCELLED",
          "TRANSFERRED_TO_IPD",
          "DISCHARGE_INITIATED",
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      dischargeDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      dischargeTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },

    },
    {
      tableName: "icu_admissions",
      timestamps: true,
    }
  );


  ICUAdmission.associate = (models) => {

    ICUAdmission.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    ICUAdmission.belongsTo(models.IPDAdmission, {
      foreignKey: "ipdAdmissionId",
      as: "ipdAdmission",
    });

    ICUAdmission.belongsTo(models.Ward, {
      foreignKey: "wardId",
      as: "ward",
    });

    ICUAdmission.belongsTo(models.Room, {
      foreignKey: "roomId",
      as: "room",
    });

    ICUAdmission.belongsTo(models.Bed, {
      foreignKey: "bedId",
      as: "bed",
    });

    ICUAdmission.belongsTo(models.Doctor, {
      foreignKey: "attendingDoctorId",
      as: "attendingDoctor",
    });

    ICUAdmission.belongsTo(models.SubDoctor, {
      foreignKey: "attendingSubDoctorId",
      as: "attendingSubDoctor",
    });

    // Future ICU tables
    // if (models.ICUVital) {
    //   ICUAdmission.hasMany(models.ICUVital, {
    //     foreignKey: "icuAdmissionId",
    //     as: "vitals",
    //   });
    // }

    // if (models.ICUDoctorNote) {
    //   ICUAdmission.hasMany(models.ICUDoctorNote, {
    //     foreignKey: "icuAdmissionId",
    //     as: "doctorNotes",
    //   });
    // }

    // if (models.ICUNursingNote) {
    //   ICUAdmission.hasMany(models.ICUNursingNote, {
    //     foreignKey: "icuAdmissionId",
    //     as: "nursingNotes",
    //   });
    // }

    // if (models.ICUIntakeOutput) {
    //   ICUAdmission.hasMany(models.ICUIntakeOutput, {
    //     foreignKey: "icuAdmissionId",
    //     as: "intakeOutput",
    //   });
    // }

    // if (models.ICUMedication) {
    //   ICUAdmission.hasMany(models.ICUMedication, {
    //     foreignKey: "icuAdmissionId",
    //     as: "medications",
    //   });
    // }

    // if (models.ICUVentilator) {
    //   ICUAdmission.hasMany(models.ICUVentilator, {
    //     foreignKey: "icuAdmissionId",
    //     as: "ventilators",
    //   });
    // }

    // if (models.ICUInvestigation) {
    //   ICUAdmission.hasMany(models.ICUInvestigation, {
    //     foreignKey: "icuAdmissionId",
    //     as: "investigations",
    //   });
    // }

    // if (models.ICUProcedure) {
    //   ICUAdmission.hasMany(models.ICUProcedure, {
    //     foreignKey: "icuAdmissionId",
    //     as: "procedures",
    //   });
    // }

    // if (models.ICUCharge) {
    //   ICUAdmission.hasMany(models.ICUCharge, {
    //     foreignKey: "icuAdmissionId",
    //     as: "charges",
    //   });
    // }

    // if (models.ICUTransfer) {
    //   ICUAdmission.hasMany(models.ICUTransfer, {
    //     foreignKey: "icuAdmissionId",
    //     as: "transfers",
    //   });
    // }

    // if (models.ICUDischarge) {
    //   ICUAdmission.hasOne(models.ICUDischarge, {
    //     foreignKey: "icuAdmissionId",
    //     as: "discharge",
    //   });
    // }
  };

  return ICUAdmission;
};

