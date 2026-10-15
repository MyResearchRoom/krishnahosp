"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "vitals",
      "insulin",
      {
        type: Sequelize.STRING,
        allowNull: true,
        after: "bp",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "vitals",
      "documentType"
    );
  },
};