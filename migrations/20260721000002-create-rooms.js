"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("rooms", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      roomNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      roomType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      wardId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "wards",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("rooms", ["wardId", "roomNumber"], {
      unique: true,
      name: "rooms_ward_id_room_number_unique",
    });
    await queryInterface.addIndex("rooms", ["doctorId"], {
      name: "rooms_doctor_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("rooms");
  },
};
