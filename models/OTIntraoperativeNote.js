"use strict";

module.exports = (sequelize, DataTypes) => {
  const OTIntraoperativeNote = sequelize.define(
    "OTIntraoperativeNote",
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

      otBookingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ot_bookings",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      postOpDiagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      startTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      endTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      estimatedBloodLossMl: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
          min: 0,
        },
      },

      patientPosition: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      operativeFindings: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      procedureDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      specimenSent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      specimenDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      drainPlaced: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      drainType: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },


      complications: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      complicationDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      instrumentSwabCounts: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      endOfProcedureCondition: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      createdById: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      createdByRole: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

    },
    {
      tableName: "ot_intraoperative_notes",
      timestamps: true,
      indexes: [
        {
          name: "idx_ot_intraop_hospital_booking",
          fields: ["hospitalId", "otBookingId"],
        },
        {
          name: "idx_ot_intraop_hospital",
          fields: ["hospitalId"],
        },
      ],
      validate: {
        endTimeAfterStartTime() {
          if (
            this.startTime &&
            this.endTime &&
            new Date(this.endTime) < new Date(this.startTime)
          ) {
            throw new Error("End time cannot be before start time.");
          }
        },

      },
    }
  );

  OTIntraoperativeNote.associate = (models) => {
    OTIntraoperativeNote.belongsTo(models.OTBooking, {
      foreignKey: "otBookingId",
      as: "booking",
    });
  };

  return OTIntraoperativeNote;
};