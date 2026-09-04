module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ipd_clinical_summaries", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      admissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      heading: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("Stable", "Under Treatment", "Critical"),
        allowNull: false,
        defaultValue: "Stable",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("ipd_clinical_summaries", ["admissionId"]);
    await queryInterface.addIndex("ipd_clinical_summaries", ["doctorId"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ipd_clinical_summaries");
  },
};
