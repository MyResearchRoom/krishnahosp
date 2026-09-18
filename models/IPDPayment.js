"use strict";

module.exports = (sequelize, DataTypes) => {
  const IPDPayment = sequelize.define(
    "IPDPayment",
    {
      paymentId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      admissionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      patientId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      doctorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      paymentMode: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Cash",
      },
      notes: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "ipd_payments",
    }
  );

  IPDPayment.associate = (models) => {
    IPDPayment.belongsTo(models.IPDInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
    IPDPayment.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    IPDPayment.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });
    IPDPayment.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
  };

  return IPDPayment;
};
