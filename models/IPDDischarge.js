"use strict";

const { encrypt, decrypt } = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const IPDDischarge = sequelize.define(
    "IPDDischarge",
    {
      dischargeId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      summaryNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      dischargeDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      dischargeTime: {
        type: DataTypes.STRING,
        allowNull: true,
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
      finalBill: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("Pending", "Discharged", "Cancelled"),
        allowNull: false,
        defaultValue: "Discharged",
      },
    },
    {
      tableName: "ipd_discharges",
    }
  );

  const ENCRYPT_FIELDS = ["diagnosis", "summaryNotes"];

  IPDDischarge.addHook("beforeCreate", (discharge) =>
    encryptFields(discharge)
  );
  IPDDischarge.addHook("beforeUpdate", (discharge) =>
    encryptFields(discharge)
  );

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field] && instance.changed(field)) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  IPDDischarge.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        try {
          values[field] = decrypt(values[field]);
        } catch (error) {
          values[field] = null;
        }
      }
    });

    return values;
  };

  IPDDischarge.associate = (models) => {
    IPDDischarge.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    IPDDischarge.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });
    IPDDischarge.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
    IPDDischarge.belongsTo(models.IPDInvoice, {
      foreignKey: "invoiceId",
      as: "invoice",
    });
  };

  return IPDDischarge;
};
