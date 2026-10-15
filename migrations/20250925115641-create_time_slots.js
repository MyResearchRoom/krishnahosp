"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("doctor_time_slots", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "doctors",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      subDoctorId: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "sub_doctors",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      slotName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: false,
      },
      maxCapacity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      availabilityIds: {
        type: Sequelize.JSON,
        allowNull: false,
      },

      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("doctor_time_slots");
  },
};
