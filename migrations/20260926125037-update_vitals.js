"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.removeColumn("vitals", "systolicBP");
    await queryInterface.removeColumn("vitals", "diastolicBP");


    await queryInterface.addColumn("vitals", "bp", {
      type: Sequelize.STRING(20),
      allowNull: true,
      after: "pulse",
    });
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn("vitals", "bp");


    await queryInterface.addColumn("vitals", "systolicBP", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });


    await queryInterface.addColumn("vitals", "diastolicBP", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};