"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("icu_nursing_notes", {
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
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      noteDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      noteTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },

      nurseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "receptionists",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      patientCondition: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      observations: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      nursingIntervention: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      patientResponse: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      additionalNotes: {
        type: Sequelize.TEXT("long"),
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

    await queryInterface.addIndex("icu_nursing_notes", {
      fields: ["hospitalId", "icuAdmissionId"],
      name: "icu_nursing_notes_hospital_icu_admission_idx",
    });

    await queryInterface.addIndex("icu_nursing_notes", {
      fields: ["hospitalId", "patientId"],
      name: "icu_nursing_notes_hospital_patient_idx",
    });

    await queryInterface.addIndex("icu_nursing_notes", {
      fields: ["hospitalId", "icuAdmissionId","patientId"],
      name: "icu_nursing_notes_hospital_icu_admission_patient_idx",
    });

    await queryInterface.addIndex("icu_nursing_notes", {
      fields: ["nurseId"],
      name: "icu_nursing_notes_nurse_idx",
    });

    await queryInterface.addIndex("icu_nursing_notes", {
      fields: ["noteDate", "noteTime"],
      name: "icu_nursing_notes_date_time_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("icu_nursing_notes");
  },
};