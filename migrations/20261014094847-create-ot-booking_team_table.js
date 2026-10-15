"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ot_booking_team", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

      teamRole: {
        type: Sequelize.ENUM(
          "primarySurgeon",
          "assistantSurgeon",
          "anaesthetist",
          "otNurse",
          "scrubNurse"
        ),
        allowNull: false,
      },

      memberType: {
        type: Sequelize.ENUM(
          "doctor",
          "subDoctor",
          "receptionist"
        ),
        allowNull: false,
      },

      memberId: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      assignedById: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      assignedByRole: {
        type: Sequelize.STRING(50),
        allowNull: false,
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
      "ot_booking_team",
      ["hospitalId", "otBookingId"],
      {
        name: "idx_ot_booking_team_hospital_booking",
      }
    );

    await queryInterface.addIndex(
      "ot_booking_team",
      ["hospitalId", "teamRole"],
      {
        name: "idx_ot_booking_team_hospital_role",
      }
    );

    await queryInterface.addIndex(
      "ot_booking_team",
      ["memberType", "memberId"],
      {
        name: "idx_ot_booking_team_member",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ot_booking_team");
  },
};