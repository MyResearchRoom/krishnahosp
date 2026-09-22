"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("doctors", "department", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "medicalDegree",
    });

    await queryInterface.addColumn("doctors", "prescriptionDisplay", {
      type: Sequelize.TINYINT,
      allowNull: false,
      defaultValue: 1,
      after: "department",
    });

    await queryInterface.addColumn("sub_doctors", "department", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "specialization",
    });

    await queryInterface.addColumn("sub_doctors", "prescriptionDisplay", {
      type: Sequelize.TINYINT,
      allowNull: false,
      defaultValue: 0,
      after: "department",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("doctors", "prescriptionDisplay");
    await queryInterface.removeColumn("doctors", "department");

    await queryInterface.removeColumn("sub_doctors", "prescriptionDisplay");
    await queryInterface.removeColumn("sub_doctors", "department");
  },
};