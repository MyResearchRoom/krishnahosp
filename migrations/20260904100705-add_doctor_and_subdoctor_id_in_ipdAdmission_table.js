"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.renameColumn(
      "ipd_admissions",
      "doctorId",
      "hospitalId"
    );

     await queryInterface.removeColumn(
      "ipd_admissions",
      "doctorRole"
    );

    await queryInterface.addColumn("ipd_admissions", "doctorId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "doctors",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("ipd_admissions", "subDoctorId", {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: "sub_doctors",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "ipd_admissions",
      "subDoctorId"
  );

    await queryInterface.removeColumn(
      "ipd_admissions",
      "doctorId"
    );

    await queryInterface.addColumn("ipd_admissions", "doctorRole", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.renameColumn(
      "ipd_admissions",
      "hospitalId",
      "doctorId"
    );
  },
};