"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ipd_admissions", "type", {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: "NORMAL",
      after: "admissionReason",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("ipd_admissions", "type");
  },
};