"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add hospitalId
    await queryInterface.addColumn("ipd_accounts", "hospitalId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after:"admissionId"
    });

    // Populate hospitalId from ipd_admissions
    await queryInterface.sequelize.query(`
      UPDATE ipd_accounts ia
      INNER JOIN ipd_admissions iaa
        ON ia.admissionId = iaa.id
      SET ia.hospitalId = iaa.hospitalId
    `);

    // Make hospitalId mandatory after existing records are populated
    await queryInterface.changeColumn("ipd_accounts", "hospitalId", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Unique account number per hospital
    await queryInterface.addIndex(
      "ipd_accounts",
      ["hospitalId", "accountNumber"],
      {
        unique: true,
        name: "ipd_accounts_hospital_id_account_number_unique",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ipd_accounts",
      "ipd_accounts_hospital_id_account_number_unique"
    );

    await queryInterface.removeColumn(
      "ipd_accounts",
      "hospitalId"
    );
  },
};