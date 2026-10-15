"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ipd_accounts", "patientUniqueId", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "patientId",
    });

    await queryInterface.addColumn("ipd_admissions", "patientUniqueId", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "patientId",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "ipd_accounts",
      "patientUniqueId"
    );

    await queryInterface.removeColumn(
      "ipd_admissions",
      "patientUniqueId"
    );
  },
};