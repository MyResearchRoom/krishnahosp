"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("sub_doctors", "role", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "subDoctor",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("sub_doctors", "role");
  },
};