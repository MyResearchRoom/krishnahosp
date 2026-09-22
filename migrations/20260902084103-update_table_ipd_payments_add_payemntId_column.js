"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ipd_payments", "paymentId", {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ipd_payments", "paymentId");
  },
};