"use strict";

module.exports = (sequelize, DataTypes) => {
  const Ward = sequelize.define(
    "Ward",
    {
      wardName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
    },
    {
      tableName: "wards",
    }
  );

  Ward.associate = (models) => {
    Ward.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });

    Ward.hasMany(models.Room, {
      foreignKey: "wardId",
      as: "rooms",
    });

    Ward.hasMany(models.Bed, {
      foreignKey: "wardId",
      as: "beds",
    });
  };

  return Ward;
};
