module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("ipd_clinical_summaries", "attendingDoctorId", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("ipd_clinical_summaries", "attendingDoctorId", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
