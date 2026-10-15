"use strict";

module.exports = (sequelize, DataTypes) => {
  const OTPreoperativeChecklistItem = sequelize.define(
    "OTPreoperativeChecklistItem",
    {
      checklistId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: "uq_checklist_item_key",
      },

      itemKey: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: "uq_checklist_item_key",
      },

      label: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM(
          "pending",
          "done",
          "not_done",
          "not_applicable"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      checkedById: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      checkedByRole: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      checkedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },

    },
    {
      tableName: "ot_preoperative_checklist_items",
      timestamps: true,
      indexes: [
        {
            name: "uq_checklist_item_key",
            unique: true,
            fields: ["checklistId", "itemKey"],
        },
        {
            name: "idx_checklist_items_checklist",
            fields: ["checklistId"],
        },
        ],
    }
  );

  OTPreoperativeChecklistItem.associate = (models) => {
    OTPreoperativeChecklistItem.belongsTo(
      models.OTPreoperativeChecklist,
      {
        foreignKey: "checklistId",
        as: "checklist",
      }
    );
  };

  return OTPreoperativeChecklistItem;
};