"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("wards", "wardType", {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: "GENERAL",
      after: "wardName",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("wards", "wardType");
  },
};