module.exports = (sequelize, DataTypes) => {
  const IPDAccountPayment = sequelize.define(
    "IPDAccountPayment",
    {
      accountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },

      paymentMode: {
        type: DataTypes.ENUM(
          "cash",
          "card",
          "upi",
          "cheque",
          "bank_transfer",
          "insurance"
        ),
        allowNull: false,
      },

      paymentDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM(
          "completed",
          "cancelled",
          "refunded"
        ),
        allowNull: false,
        defaultValue: "completed",
      },
    },
    {
      tableName: "ipd_account_payments",
      timestamps: true,
    }
  );

  IPDAccountPayment.associate = (models) => {
    IPDAccountPayment.belongsTo(models.IPDAccount, {
      foreignKey: "accountId",
      as: "account",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return IPDAccountPayment;
};