module.exports = (sequelize, DataTypes) => {
  const IPDAccount = sequelize.define(
    "IPDAccount",
    {
      accountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      patientUniqueId: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      admissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },

      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      advancePayment: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      paidAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      remainingAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      paymentStatus: {
        type: DataTypes.ENUM(
          "pending",
          "partial",
          "paid",
          "refunded"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      status: {
        type: DataTypes.ENUM(
          "open",
          "closed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "open",
      },

      openedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "ipd_accounts",
      timestamps: true,
    }
  );

  IPDAccount.associate = (models) => {

    IPDAccount.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    IPDAccount.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    IPDAccount.hasMany(models.IPDAccountCharge, {
        foreignKey: "accountId",
        as: "charges",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
    });

    IPDAccount.hasMany(models.IPDAccountPayment, {
      foreignKey: "accountId",
      as: "payments",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

  };

  return IPDAccount;
};