"use strict";

module.exports = (sequelize, DataTypes) => {
  const BirthCertificate = sequelize.define(
    "BirthCertificate",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      certificateNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      newbornId: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      motherPatientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },//from patient table this is primary key

      motherPatientUniqueId: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },//from patient table

      motherName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      fatherName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      babyName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      babySex: {
        type: DataTypes.ENUM("Male", "Female", "Other"),
        allowNull: false,
      },

      babyBloodGroup: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },

      babyDateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      babyTimeOfBirth: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      babyWeight: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },

      motherNationality: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      motherReligion: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      fatherNationality: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      fatherReligion: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      presentAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      permanentAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      createdBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      createdByRole: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: "birth_certificates",
      timestamps: true,
    }
  );

  BirthCertificate.associate = (models)=>{
    BirthCertificate.belongsTo(models.Patient, {
      foreignKey: "motherPatientId",
      as: "mother",
    });

  };

  return BirthCertificate;
};