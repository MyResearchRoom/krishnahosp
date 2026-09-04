"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("appointments", "note", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("appointments", "note", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};