"use strict";

module.exports = (sequelize, DataTypes) => {
    const OperatingTheatre = sequelize.define(
        "OperatingTheatre",
        {
            hospitalId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: "unique_hospital_theatre_code",
            },
            theatreCode: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: "unique_hospital_theatre_code",
            },
            theatreName: {
                type: DataTypes.STRING(150),
                allowNull: false,
            },

            location: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            specialty: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM(
                    "available",
                    "occupied",
                    "maintenance",
                    "inActive",),
                allowNull: false,
                defaultValue: "available",
            },
            isBlock: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },

        },
        {
            tableName: "operating_theatres",
            timestamps: true,
        }
    );

    return OperatingTheatre;
};