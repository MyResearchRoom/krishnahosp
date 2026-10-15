"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ipd_admissions", "clinicalStatus", {
      type: Sequelize.ENUM(
        "Stable",
        "Under Treatment",
        "Critical",
        "Discharged"
      ),
      allowNull: false,
      defaultValue: "Stable",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("ipd_admissions", "clinicalStatus", {
      type: Sequelize.ENUM(
        "Stable",
        "Under Treatment",
        "Critical"
      ),
      allowNull: false,
      defaultValue: "Stable",
    });
  },
};