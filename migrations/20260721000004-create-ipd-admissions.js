"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ipd_admissions", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      admissionNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      attendingDoctorName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      doctorRole: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      department: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      admissionReason: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      diagnosis: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      clinicalStatus: {
        type: Sequelize.ENUM("Stable", "Under Treatment", "Critical"),
        allowNull: false,
        defaultValue: "Stable",
      },
      status: {
        type: Sequelize.ENUM("admitted", "discharged", "cancelled"),
        allowNull: false,
        defaultValue: "admitted",
      },
      admissionDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      dischargedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      advancePayment: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
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
      wardId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "wards",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      roomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "rooms",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      bedId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "beds",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("ipd_admissions", ["doctorId", "status"], {
      name: "ipd_admissions_doctor_id_status",
    });
    await queryInterface.addIndex("ipd_admissions", ["doctorId", "admissionNumber"], {
      unique: true,
      name: "ipd_admissions_doctor_id_admission_number_unique",
    });
    await queryInterface.addIndex("ipd_admissions", ["bedId", "status"], {
      name: "ipd_admissions_bed_id_status",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ipd_admissions");
  },
};
