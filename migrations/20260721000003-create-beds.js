"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("beds", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      bedCode: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      bedType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      pricePerDay: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM(
          "available",
          "occupied",
          "maintenance",
          "discharged"
        ),
        allowNull: false,
        defaultValue: "available",
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
      roomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "rooms",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      patientId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "patients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("beds", ["roomId", "bedCode"], {
      unique: true,
      name: "beds_room_id_bed_code_unique",
    });
    await queryInterface.addIndex("beds", ["doctorId", "status"], {
      name: "beds_doctor_id_status",
    });
    await queryInterface.addIndex("beds", ["wardId"], {
      name: "beds_ward_id",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("beds");
  },
};
