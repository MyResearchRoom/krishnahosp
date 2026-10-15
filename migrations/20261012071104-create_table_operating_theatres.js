"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("operating_theatres", {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },

            hospitalId: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },

            theatreCode: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },

            theatreName: {
                type: Sequelize.STRING(150),
                allowNull: false,
            },

            location: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },

            specialty: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },

            status: {
                type: Sequelize.ENUM(
                    "available",
                    "occupied",
                    "maintenance",
                    "inActive"
                ),
                allowNull: false,
                defaultValue: "available",
            },
            isBlock: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },

            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },

            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addConstraint("operating_theatres", {
            fields: ["hospitalId", "theatreCode"],
            type: "unique",
            name: "unique_hospital_theatre_code",
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable("operating_theatres");
    },
};