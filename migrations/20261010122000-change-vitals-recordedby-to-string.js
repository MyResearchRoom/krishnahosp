"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("vitals", "recordedBy", {
      type: Sequelize.STRING(100),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("vitals", "recordedBy", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
