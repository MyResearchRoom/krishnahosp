"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ipd_account_payments", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      accountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ipd_accounts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      paymentNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },

      paymentMode: {
        type: Sequelize.ENUM(
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
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(
          "completed",
          "cancelled",
          "refunded"
        ),
        allowNull: false,
        defaultValue: "completed",
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ipd_account_payments");
  },
};