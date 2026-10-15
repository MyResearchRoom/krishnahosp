"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("birth_certificates", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      certificateNumber: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      newbornId: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      motherPatientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "patients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },

      motherPatientUniqueId: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      motherName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      fatherName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      babyName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      babySex: {
        type: Sequelize.ENUM("Male", "Female", "Other"),
        allowNull: false,
      },

      babyBloodGroup: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },

      babyDateOfBirth: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      babyTimeOfBirth: {
        type: Sequelize.TIME,
        allowNull: false,
      },

      babyWeight: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      motherNationality: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      motherReligion: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      fatherNationality: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      fatherReligion: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      presentAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      permanentAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdBy: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      createdByRole: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addIndex("birth_certificates", {
      fields: ["hospitalId", "certificateNumber"],
      unique: true,
      name: "birth_certificate_hospital_certificate_number_unique",
    });

    await queryInterface.addIndex("birth_certificates", {
      fields: ["hospitalId", "newbornId"],
      unique: true,
      name: "birth_certificate_hospital_newborn_unique",
    });

    await queryInterface.addIndex("birth_certificates", {
      fields: ["hospitalId", "motherPatientId"],
      name: "birth_certificate_hospital_mother_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("birth_certificates");
  },
};