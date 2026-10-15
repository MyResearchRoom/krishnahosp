"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("audit_logs", "subDoctorId", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "doctorId",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("audit_logs", "subDoctorId");
  },
};
