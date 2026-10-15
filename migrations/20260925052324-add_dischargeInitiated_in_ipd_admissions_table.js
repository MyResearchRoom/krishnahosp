"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ipd_admissions", "status", {
      type: Sequelize.ENUM(
        "admitted", "discharged", "cancelled","transfer to ICU","discharge Initiated"
      ),
      allowNull: false,
      defaultValue: "admitted",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ipd_admissions", "status", {
      type: Sequelize.ENUM(
        "admitted", "discharged", "cancelled","transfer to ICU"
      ),
      allowNull: false,
      defaultValue: "admitted",
    });
  },
};