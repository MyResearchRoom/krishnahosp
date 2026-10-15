"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("icu_medications", {
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
        allowNull: false,
      },

      medicineName: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      dose: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      route: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      frequency: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      createdBy: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      createdByRole: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      status: {
        type: Sequelize.ENUM(
          "ACTIVE",
          "STOPPED",
          "COMPLETED",
          "CANCELLED"
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      instructions: {
        type: Sequelize.TEXT,
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
      "icu_medications",
      ["hospitalId", "icuAdmissionId"],
      {
        name: "idx_icu_medications_hospital_admission",
      }
    );

    await queryInterface.addIndex("icu_medications", 
      [
        "hospitalId",
        "icuAdmissionId",
        "patientId",
      ],
      {
        name: "idx_icu_medications_hospital_admission_patient",
      }
    );

    await queryInterface.addIndex(
      "icu_medications",
      ["hospitalId", "patientId"],
      {
        name: "idx_icu_medications_hospital_patient",
      }
    );

    await queryInterface.addIndex(
      "icu_medications",
      ["hospitalId", "status"],
      {
        name: "idx_icu_medications_hospital_status",
      }
    );

    await queryInterface.addIndex(
      "icu_medications",
      ["hospitalId", "startDate"],
      {
        name: "idx_icu_medications_hospital_start_date",
      }
    );


  },

  async down(queryInterface) {
    await queryInterface.dropTable("icu_medications");
  },
};
