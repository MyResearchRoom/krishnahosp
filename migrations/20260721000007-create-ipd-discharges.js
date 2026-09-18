"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ipd_discharges", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      dischargeId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      diagnosis: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      summaryNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      dischargeDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      dischargeTime: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      finalBill: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("Pending", "Discharged", "Cancelled"),
        allowNull: false,
        defaultValue: "Discharged",
      },
      admissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ipd_admissions",
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
        onDelete: "RESTRICT",
      },
      invoiceId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "ipd_invoices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("ipd_discharges", ["doctorId", "dischargeId"], {
      unique: true,
      name: "ipd_discharges_doctor_id_discharge_id_unique",
    });
    await queryInterface.addIndex("ipd_discharges", ["doctorId", "status"], {
      name: "ipd_discharges_doctor_id_status",
    });
    await queryInterface.addIndex("ipd_discharges", ["admissionId"], {
      unique: true,
      name: "ipd_discharges_admission_id_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ipd_discharges");
  },
};
