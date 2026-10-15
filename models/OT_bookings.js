"use strict";

module.exports = (sequelize, DataTypes) => {
  const OTBooking = sequelize.define(
    "OTBooking",
    {
      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: "unique_hospital_surgery_no",
      },
      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      surgeryNo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: "unique_hospital_surgery_no",
      },
      ipdAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      icuAdmissionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      theatreId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      procedureName: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      specialty: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      scheduleDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      estimatedDurationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
        },
      },
      scheduledStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      scheduledEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      actualStartDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },
      actualStartTime: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
      },
      actualEndTime: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
      },

      doctorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      subDoctorId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      doctorRole: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      priority: {
        type: DataTypes.ENUM("routine", "urgent", "emergency"),
        allowNull: false,
        defaultValue: "routine",
      },

      anaesthesia: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue:"General",
      },

      status: {
        type: DataTypes.ENUM(
          "requested",
          "scheduled",
          "in_progress",
          "completed",
          "cancelled",
          "postponed"
        ),
        allowNull: false,
        defaultValue: "requested",
      },

      disgnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      requestedBy: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      requestedByRole: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName: "ot_bookings",
      timestamps: true,
      validate: {
        scheduledEndAfterStart() {
          if (
            this.scheduledStartTime &&
            this.scheduledEndTime &&
            this.scheduledEndTime <= this.scheduledStartTime
          ) {
            throw new Error("Scheduled end time must be after scheduled start time.");
          }
        },
      },
    }
  );

  OTBooking.associate = (models) => {
    OTBooking.belongsTo(models.OperatingTheatre, {
      foreignKey: "theatreId",
      as: "theatre",
    });

    OTBooking.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });

    OTBooking.belongsTo(models.IPDAdmission, {
      foreignKey: "ipdAdmissionId",
      as: "ipdAdmission",
    });

    OTBooking.belongsTo(models.ICUAdmission, {
      foreignKey: "icuAdmissionId",
      as: "icuAdmission",
    });

    OTBooking.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    OTBooking.belongsTo(models.SubDoctor, {
      foreignKey: "subDoctorId",
      as: "subDoctor",
    });

    OTBooking.hasOne(models.OTPreoperativeChecklist, {
      foreignKey: "otBookingId",
      as: "preoperativeChecklist",
    });

  };

  return OTBooking;
};
