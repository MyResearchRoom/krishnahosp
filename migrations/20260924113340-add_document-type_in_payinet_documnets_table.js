"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "patient_documents",
      "documentType",
      {
        type: Sequelize.STRING,
        allowNull: true,
        after: "admissionId",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "patient_documents",
      "documentType"
    );
  },
};