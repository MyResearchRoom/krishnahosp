"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "ipd_account_charges",
      "isActive",
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        after:"chargeDate",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "ipd_account_charges",
      "isActive"
    );
  },
};
