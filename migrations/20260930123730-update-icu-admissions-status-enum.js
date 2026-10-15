"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("icu_admissions", "status", {
      type: Sequelize.ENUM(
        "ACTIVE",
        "TRANSFERRED",
        "TRANSFERRED_TO_IPD",
        "DISCHARGE_INITIATED",
        "DISCHARGED",
        "CANCELLED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("icu_admissions", "status", {
      type: Sequelize.ENUM(
        "ACTIVE",
        "TRANSFERRED",
        "DISCHARGED",
        "CANCELLED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
    });
  },
};