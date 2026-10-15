"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("sub_doctors", "otp", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("sub_doctors", "otpExpiry", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("sub_doctors", "otp");
    await queryInterface.removeColumn("sub_doctors", "otpExpiry");
  },
};
