"use strict";

const { encrypt, decrypt } = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const IPDAdmission = sequelize.define(
    "IPDAdmission",
    {
      admissionNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attendingDoctorName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      doctorRole: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      department: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      admissionReason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      clinicalStatus: {
        type: DataTypes.ENUM("Stable", "Under Treatment", "Critical"),
        allowNull: false,
        defaultValue: "Stable",
      },
      status: {
        type: DataTypes.ENUM("admitted", "discharged", "cancelled"),
        allowNull: false,
        defaultValue: "admitted",
      },
      admissionDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      dischargedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      advancePayment: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "ipd_admissions",
    }
  );

  const ENCRYPT_FIELDS = ["admissionReason", "diagnosis"];

  IPDAdmission.addHook("beforeCreate", (admission) =>
    encryptFields(admission)
  );
  IPDAdmission.addHook("beforeUpdate", (admission) =>
    encryptFields(admission)
  );

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field] && instance.changed(field)) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  IPDAdmission.prototype.toJSON = function () {
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

  IPDAdmission.associate = (models) => {
    IPDAdmission.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    IPDAdmission.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
    IPDAdmission.belongsTo(models.Ward, {
      foreignKey: "wardId",
      as: "ward",
    });
    IPDAdmission.belongsTo(models.Room, {
      foreignKey: "roomId",
      as: "room",
    });
    IPDAdmission.belongsTo(models.Bed, {
      foreignKey: "bedId",
      as: "bed",
    });
    IPDAdmission.hasMany(models.BedTransfer, {
      foreignKey: "admissionId",
      as: "transfers",
    });
    IPDAdmission.hasOne(models.IPDDischarge, {
      foreignKey: "admissionId",
      as: "discharge",
    });
    IPDAdmission.hasMany(models.IPDInvoice, {
      foreignKey: "admissionId",
      as: "invoices",
    });
  };

  return IPDAdmission;
};
