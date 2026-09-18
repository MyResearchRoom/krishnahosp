module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("doctors", "prescriptionDisplay", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.changeColumn("sub_doctors", "prescriptionDisplay", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("doctors", "prescriptionDisplay", {
      type: Sequelize.TINYINT,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.changeColumn("sub_doctors", "prescriptionDisplay", {
      type: Sequelize.TINYINT,
      allowNull: false,
      defaultValue: 0,
    });
  },
};