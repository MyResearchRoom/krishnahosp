"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("receptionists", "role", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "receptionist",
      after: "id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receptionists", "role");
  },
};