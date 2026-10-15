"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("icu_doctor_notes", "noteDate", {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await queryInterface.addColumn("icu_doctor_notes", "noteTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE icu_doctor_notes
      SET noteTime = '00:00:00'
      WHERE noteTime IS NULL
    `);

    await queryInterface.changeColumn("icu_doctor_notes", "noteTime", {
      type: Sequelize.TIME,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("icu_doctor_notes", "noteTime", {
      type: Sequelize.TIME,
      allowNull: true,
    });

    await queryInterface.removeColumn("icu_doctor_notes", "noteTime");

    await queryInterface.changeColumn("icu_doctor_notes", "noteDate", {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },
};