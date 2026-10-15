"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OTBookingTeam extends Model {
    static associate(models) {
      OTBookingTeam.belongsTo(models.OTBooking, {
        foreignKey: "otBookingId",
        as: "booking",
      });
    }
  }

  OTBookingTeam.init(
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

      teamRole: {
        type: DataTypes.ENUM(
          "primarySurgeon",
          "assistantSurgeon",
          "anaesthetist",
          "otNurse",
          "scrubNurse"
        ),
        allowNull: false,
      },

      memberType: {
        type: DataTypes.ENUM(
          "doctor",
          "subDoctor",
          "receptionist"
        ),
        allowNull: false,
      },

      memberId: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      assignedById: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      assignedByRole: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "OTBookingTeam",
      tableName: "ot_booking_team",
      timestamps: true,
      indexes: [
        {
          fields: ["hospitalId", "otBookingId"],
          name: "idx_ot_booking_team_hospital_booking",
        },
        {
          fields: ["hospitalId", "teamRole"],
          name: "idx_ot_booking_team_hospital_role",
        },
        {
          fields: ["memberType", "memberId"],
          name: "idx_ot_booking_team_member",
        },
      ],
    }
  );

  return OTBookingTeam;
};