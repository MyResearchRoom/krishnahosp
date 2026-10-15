"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("vitals", {
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

      recordedAtDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      recordedAtTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },

      temperature: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      pulse: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      systolicBP: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      diastolicBP: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      spo2: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      bsl: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },

      respiratoryRate: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      recordedBy: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      recordedByRole: {
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


    await queryInterface.addIndex("vitals", ["hospitalId"], {
      name: "idx_vitals_hospitalId",
    });

    await queryInterface.addIndex("vitals", ["patientId"], {
      name: "idx_vitals_patientId",
    });

    await queryInterface.addIndex("vitals", ["ipdAdmissionId"], {
      name: "idx_vitals_ipdAdmissionId",
    });

    await queryInterface.addIndex("vitals", ["icuAdmissionId"], {
      name: "idx_vitals_icuAdmissionId",
    });

    await queryInterface.addIndex(
      "vitals",
      ["hospitalId", "patientId", "recordedAtDate", "recordedAtTime"],
      {
        name: "idx_vitals_patient_datetime",
      }
    );

    await queryInterface.addIndex(
      "vitals",
      ["hospitalId", "ipdAdmissionId", "recordedAtDate", "recordedAtTime"],
      {
        name: "idx_vitals_ipd_datetime",
      }
    );

    await queryInterface.addIndex(
      "vitals",
      ["hospitalId", "icuAdmissionId", "recordedAtDate", "recordedAtTime"],
      {
        name: "idx_vitals_icu_datetime",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("vitals");
  },
};