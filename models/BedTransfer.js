"use strict";

const { encrypt, decrypt } = require("../utils/cryptography");

module.exports = (sequelize, DataTypes) => {
  const BedTransfer = sequelize.define(
    "BedTransfer",
    {
      transferNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      transferredAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fromBedChargePerDay: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      toBedChargePerDay: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM("completed", "cancelled"),
        allowNull: false,
        defaultValue: "completed",
      },
    },
    {
      tableName: "bed_transfers",
    }
  );

  BedTransfer.addHook("beforeCreate", (transfer) => encryptReason(transfer));
  BedTransfer.addHook("beforeUpdate", (transfer) => encryptReason(transfer));

  function encryptReason(instance) {
    if (instance.reason && instance.changed("reason")) {
      instance.reason = encrypt(instance.reason);
    }
  }

  BedTransfer.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    if (values.reason) {
      try {
        values.reason = decrypt(values.reason);
      } catch (error) {
        values.reason = null;
      }
    }

    return values;
  };

  BedTransfer.associate = (models) => {
    BedTransfer.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });
    BedTransfer.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });
    BedTransfer.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
    BedTransfer.belongsTo(models.Ward, {
      foreignKey: "fromWardId",
      as: "fromWard",
    });
    BedTransfer.belongsTo(models.Room, {
      foreignKey: "fromRoomId",
      as: "fromRoom",
    });
    BedTransfer.belongsTo(models.Bed, {
      foreignKey: "fromBedId",
      as: "fromBed",
    });
    BedTransfer.belongsTo(models.Ward, {
      foreignKey: "toWardId",
      as: "toWard",
    });
    BedTransfer.belongsTo(models.Room, {
      foreignKey: "toRoomId",
      as: "toRoom",
    });
    BedTransfer.belongsTo(models.Bed, {
      foreignKey: "toBedId",
      as: "toBed",
    });
  };

  return BedTransfer;
};
