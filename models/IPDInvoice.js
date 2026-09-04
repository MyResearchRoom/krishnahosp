"use strict";

module.exports = (sequelize, DataTypes) => {
  const IPDInvoice = sequelize.define(
    "IPDInvoice",
    {
      invoiceNo: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      bedChargePerDay: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      stayDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      bedCharge: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      medicalCharges: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      otherCharges: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dueAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paymentStatus: {
        type: DataTypes.ENUM("Paid", "Pending", "Partial"),
        allowNull: false,
        defaultValue: "Pending",
      },
      paidDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: "ipd_invoices",
    }
  );

  IPDInvoice.associate = (models) => {
    IPDInvoice.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    IPDInvoice.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });
    IPDInvoice.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
    IPDInvoice.hasOne(models.IPDDischarge, {
      foreignKey: "invoiceId",
      as: "discharge",
    });
    IPDInvoice.hasMany(models.IPDPayment, {
      foreignKey: "invoiceId",
      as: "payments",
    });
  };

  return IPDInvoice;
};
