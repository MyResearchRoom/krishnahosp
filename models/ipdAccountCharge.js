module.exports = (sequelize, DataTypes) => {
  const IPDAccountCharge = sequelize.define(
    "IPDAccountCharge",
    {
      accountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      chargeName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
      },

      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },

      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },

      chargeDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

    },
    {
      tableName: "ipd_account_charges",
      timestamps: true,
    }
  );

  IPDAccountCharge.associate = (models) => {
    IPDAccountCharge.belongsTo(models.IPDAccount, {
      foreignKey: "accountId",
      as: "account",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return IPDAccountCharge;
};