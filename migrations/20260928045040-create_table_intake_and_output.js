"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("intake_and_output", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      ipdAdmissionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "ipd_admissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      icuAdmissionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "icu_admissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "patients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      patientUniqueId: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      patientUniqueId: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      category: {
        type: Sequelize.ENUM("intake", "output"),
        allowNull: false,
      },

      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      quantity: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      time: {
        type: Sequelize.TIME,
        allowNull: false,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      recordedBy: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      recordedByRole: {
        type: Sequelize.STRING(100),
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
    await queryInterface.dropTable("intake_and_output");
  },
};