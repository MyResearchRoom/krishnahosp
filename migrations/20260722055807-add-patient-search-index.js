"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("patients", {
      name: "patients_doctor_name_search_idx",
      fields: ["doctorId", "nameSearch"],
    });
    await queryInterface.addIndex("patients", {
      name: "patients_doctor_mobile_search_idx",
      fields: ["doctorId", "mobileSearch"],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("patients", "patients_doctor_name_search_idx");
    await queryInterface.removeIndex("patients", "patients_doctor_mobile_search_idx");
  },
};