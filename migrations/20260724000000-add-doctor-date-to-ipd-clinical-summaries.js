module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ipd_clinical_summaries", "attendingDoctorId", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("ipd_clinical_summaries", "attendingDoctorType", {
      type: Sequelize.ENUM("doctor", "subDoctor"),
      allowNull: true,
      defaultValue: "doctor",
    });

    await queryInterface.addColumn("ipd_clinical_summaries", "date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE ipd_clinical_summaries
      SET
        attendingDoctorId = doctorId,
        attendingDoctorType = 'doctor',
        date = DATE(createdAt)
      WHERE attendingDoctorId IS NULL
    `);

    await queryInterface.changeColumn("ipd_clinical_summaries", "attendingDoctorId", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("ipd_clinical_summaries", "attendingDoctorType", {
      type: Sequelize.ENUM("doctor", "subDoctor"),
      allowNull: false,
      defaultValue: "doctor",
    });

    await queryInterface.changeColumn("ipd_clinical_summaries", "date", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.addIndex("ipd_clinical_summaries", ["attendingDoctorId"]);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("ipd_clinical_summaries", ["attendingDoctorId"]);
    await queryInterface.removeColumn("ipd_clinical_summaries", "date");
    await queryInterface.removeColumn("ipd_clinical_summaries", "attendingDoctorType");
    await queryInterface.removeColumn("ipd_clinical_summaries", "attendingDoctorId");
  },
};