"use strict";

module.exports = (sequelize, DataTypes) => {
  const OTPreoperativeChecklist = sequelize.define(
    "OTPreoperativeChecklist",
    {
      otBookingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: "uq_ot_preoperative_checklist_booking",
      },

      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM(
          "pending",
          "in_progress",
          "completed"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },

      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },

      createdById: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      createdByRole: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: "ot_preoperative_checklists",
      timestamps: true,
      indexes: [
        {
          name: "idx_ot_preoperative_checklist_hospital",
          fields: ["hospitalId"],
        },
      ],
    }
  );

  OTPreoperativeChecklist.associate = (models) => {
    OTPreoperativeChecklist.belongsTo(models.OTBooking, {
      foreignKey: "otBookingId",
      as: "otBooking",
    });

    OTPreoperativeChecklist.hasMany(
      models.OTPreoperativeChecklistItem,
      {
        foreignKey: "checklistId",
        as: "items",
      }
    );
  };

  return OTPreoperativeChecklist;
};