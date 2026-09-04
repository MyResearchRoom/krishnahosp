"use strict";

module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define(
    "Room",
    {
      roomNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      roomType: {
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
      tableName: "rooms",
    }
  );

  Room.associate = (models) => {
    Room.belongsTo(models.Doctor, {
      foreignKey: "doctorId",
      as: "doctor",
    });

    Room.belongsTo(models.Ward, {
      foreignKey: "wardId",
      as: "ward",
    });

    Room.hasMany(models.Bed, {
      foreignKey: "roomId",
      as: "beds",
    });
  };

  return Room;
};
