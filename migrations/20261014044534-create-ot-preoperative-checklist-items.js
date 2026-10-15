
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "ot_preoperative_checklist_items",
      {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },

        checklistId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "ot_preoperative_checklists",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },

        itemKey: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },

        label: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },

        status: {
          type: Sequelize.ENUM(
            "pending",
            "done",
            "not_done",
            "not_applicable"
          ),
          allowNull: false,
          defaultValue: "pending",
        },

        checkedById: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },

        checkedByRole: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },

        checkedAt: {
          type: Sequelize.DATE,
          allowNull: true,
          defaultValue: null,
        },


        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },

        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
          ),
        },
      }
    );

    await queryInterface.addIndex(
      "ot_preoperative_checklist_items",
      ["checklistId", "itemKey"],
      {
        name: "uq_checklist_item_key",
        unique: true,
      }
    );

    // Index for fetching items by checklistId
    await queryInterface.addIndex(
      "ot_preoperative_checklist_items",
      ["checklistId"],
      {
        name: "idx_checklist_items_checklist",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ot_preoperative_checklist_items");
  },
};
