"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("icu_care_plan", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      icuAdmissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "icu_admissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "patients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      patientUniqueId: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      problem: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },

      goal: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },

      intervention: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },

      frequency: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      assignedNurseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      reviewDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(
          "ACTIVE",
          "COMPLETED",
          "CANCELLED",
          "INPROCESS",
          "OVER_DUE",
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      createdBy: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      createdByRole: {
        type: Sequelize.STRING,
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

    await queryInterface.addIndex("icu_care_plan", [
      "hospitalId",
      "icuAdmissionId",
    ]);

    await queryInterface.addIndex("icu_care_plan", [
      "hospitalId",
      "patientId",
    ]);

    await queryInterface.addIndex("icu_care_plan", [
      "hospitalId",
      "icuAdmissionId",
      "patientId",
    ]);

    await queryInterface.addIndex("icu_care_plan", [
      "hospitalId",
      "status",
    ]);

    await queryInterface.addIndex("icu_care_plan", [
      "assignedNurseId",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("icu_care_plan");
  },
};