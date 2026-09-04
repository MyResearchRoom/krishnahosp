"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ipd_invoices", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      invoiceNo: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      bedChargePerDay: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      stayDays: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      bedCharge: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      medicalCharges: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      otherCharges: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paidAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dueAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paymentStatus: {
        type: Sequelize.ENUM("Paid", "Pending", "Partial"),
        allowNull: false,
        defaultValue: "Pending",
      },
      paidDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
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

    await queryInterface.addIndex("ipd_invoices", ["doctorId", "invoiceNo"], {
      unique: true,
      name: "ipd_invoices_doctor_id_invoice_no_unique",
    });
    await queryInterface.addIndex("ipd_invoices", ["doctorId", "paymentStatus"], {
      name: "ipd_invoices_doctor_id_payment_status",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ipd_invoices");
  },
};
