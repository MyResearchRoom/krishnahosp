
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ot_preoperative_checklists", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      otBookingId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ot_bookings",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM("pending", "in_progress", "completed"),
        allowNull: false,
        defaultValue: "pending",
      },

      startedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      createdById: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      createdByRole: {
        type: Sequelize.STRING(50),
        allowNull: true,
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
    });


    await queryInterface.addIndex(
      "ot_preoperative_checklists",
      ["otBookingId"],
      {
        name: "uq_ot_preoperative_checklist_booking",
        unique: true,
      }
    );

    await queryInterface.addIndex(
      "ot_preoperative_checklists",
      ["hospitalId"],
      {
        name: "idx_ot_preoperative_checklist_hospital",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ot_preoperative_checklists");
  },
};
