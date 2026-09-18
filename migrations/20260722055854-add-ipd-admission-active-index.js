"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("ipd_admissions", {
      name: "ipd_admissions_patient_status_idx",
      fields: ["patientId", "doctorId", "status"],
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ipd_admissions", "ipd_admissions_patient_status_idx");
  },
};