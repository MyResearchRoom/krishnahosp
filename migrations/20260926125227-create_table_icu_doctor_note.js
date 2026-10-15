"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("icu_doctor_notes", {
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

      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      subDoctorId: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "sub_doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      createdByRole: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      noteDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      chiefComplaint: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      clinicalFindings: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      advice: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      diagnosis: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      treatmentPlan: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },

      notes: {
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


    await queryInterface.addIndex(
      "icu_doctor_notes",
      ["hospitalId"],
      {
        name: "idx_icu_doctor_notes_hospital_id",
      }
    );

    await queryInterface.addIndex(
      "icu_doctor_notes",
      ["icuAdmissionId"],
      {
        name: "idx_icu_doctor_notes_icu_admission_id",
      }
    );

    await queryInterface.addIndex("icu_doctor_notes", {
      fields: ["hospitalId", "icuAdmissionId","patientId"],
      name: "icu_doctor_notes_hospital_icu_admission_patient_idx",
    });

    await queryInterface.addIndex(
      "icu_doctor_notes",
      ["patientId"],
      {
        name: "idx_icu_doctor_notes_patient_id",
      }
    );

    await queryInterface.addIndex(
      "icu_doctor_notes",
      ["icuAdmissionId", "noteDate"],
      {
        name: "idx_icu_doctor_notes_admission_date",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "icu_doctor_notes",
      "idx_icu_doctor_notes_hospital_id"
    );

    await queryInterface.removeIndex(
      "icu_doctor_notes",
      "idx_icu_doctor_notes_icu_admission_id"
    );

    await queryInterface.removeIndex(
      "icu_doctor_notes",
      "idx_icu_doctor_notes_patient_id"
    );

    await queryInterface.removeIndex(
      "icu_doctor_notes",
      "idx_icu_doctor_notes_admission_date"
    );

    await queryInterface.dropTable("icu_doctor_notes");
  },
};