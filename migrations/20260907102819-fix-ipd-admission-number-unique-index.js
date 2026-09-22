"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex(
      "ipd_admissions",
      "ipd_admissions_doctor_id_admission_number_unique"
    );

    await queryInterface.addIndex(
      "ipd_admissions",
      ["hospitalId", "admissionNumber"],
      {
        unique: true,
        name: "ipd_admissions_hospital_id_admission_number_unique",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "ipd_admissions",
      "ipd_admissions_hospital_id_admission_number_unique"
    );

    await queryInterface.addIndex(
      "ipd_admissions",
      ["hospitalId", "admissionNumber"],
      {
        unique: true,
        name: "ipd_admissions_doctor_id_admission_number_unique",
      }
    );
  },
};