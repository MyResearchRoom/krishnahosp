"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("investigations", {
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

      investigationName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      result: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      document: {
        type: Sequelize.BLOB("long"),
        allowNull: true,
      },

      documentMimeType: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      investigationDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      createdByRole: {
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("investigations");
  },
};