"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("icu_admissions", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      icuAdmissionNumber: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
        allowNull: true,
      },

      ipdAdmissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ipd_admissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      wardId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "wards",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      roomId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "rooms",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      bedId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "beds",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      admissionDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      admissionTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },

      admissionType: {
        type: Sequelize.ENUM(
          "DIRECT",
          "EMERGENCY",
          "PLANNED",
          "POST_OPERATIVE",
          "TRANSFER_FROM_IPD",
          "TRANSFER_FROM_OTHER_HOSPITAL"
        ),
        allowNull: false,
        defaultValue: "TRANSFER_FROM_IPD",
      },

      admissionReason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      diagnosis: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      clinicalStatus: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      attendingDoctorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      attendingSubDoctorId: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "sub_doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      admissionNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(
          "ACTIVE",
          "TRANSFERRED",
          "DISCHARGED",
          "CANCELLED"
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      dischargeDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      dischargeTime: {
        type: Sequelize.TIME,
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

    // Indexes
    await queryInterface.addIndex("icu_admissions", ["hospitalId"], {
      name: "idx_icu_admissions_hospitalId",
    });

    await queryInterface.addIndex("icu_admissions", ["patientId"], {
      name: "idx_icu_admissions_patientId",
    });

    await queryInterface.addIndex("icu_admissions", ["ipdAdmissionId"], {
      name: "idx_icu_admissions_ipdAdmissionId",
    });

    await queryInterface.addIndex("icu_admissions", ["wardId"], {
      name: "idx_icu_admissions_wardId",
    });

    await queryInterface.addIndex("icu_admissions", ["roomId"], {
      name: "idx_icu_admissions_roomId",
    });

    await queryInterface.addIndex("icu_admissions", ["bedId"], {
      name: "idx_icu_admissions_bedId",
    });

    await queryInterface.addIndex("icu_admissions", ["status"], {
      name: "idx_icu_admissions_status",
    });

    await queryInterface.addIndex("icu_admissions", ["admissionDate"], {
      name: "idx_icu_admissions_admissionDate",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("icu_admissions");
  },
};