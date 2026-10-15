"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("appointments", "doctorId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "doctors",
        key: "id",
      },
    });
    await queryInterface.addColumn("appointments", "subDoctorId", {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: "sub_doctors",
        key: "id",
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("appointments", "doctorId");
    await queryInterface.removeColumn("appointments", "subDoctorId");
  },
};
