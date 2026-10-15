"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ot_intraoperative_notes", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      hospitalId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      otBookingId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ot_bookings",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      postOpDiagnosis: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      startTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      endTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      estimatedBloodLossMl: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      patientPosition: {
       type: Sequelize.STRING(255),
        allowNull: true,
      },


      operativeFindings: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      procedureDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      specimenSent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      specimenDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
      },


      drainPlaced: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      drainType: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      complications: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      complicationDetails: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

    
      instrumentSwabCounts: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      endOfProcedureCondition: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdById: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      createdByRole: {
        type: Sequelize.STRING(50),
        allowNull: false,
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

    await queryInterface.addIndex(
      "ot_intraoperative_notes",
      ["hospitalId", "otBookingId"],
      {
        name: "idx_ot_intraop_hospital_booking",
      }
    );

    await queryInterface.addIndex(
      "ot_intraoperative_notes",
      ["hospitalId"],
      {
        name: "idx_ot_intraop_hospital",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ot_intraoperative_notes");
  },
};