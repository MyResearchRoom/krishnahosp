"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("icu_procedures", {
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

      procedureName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      procedureDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      procedureTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },

      preProcedureNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      indication: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      complications: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },

      postProcedureCondition: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.dropTable("icu_procedures");
  },
};