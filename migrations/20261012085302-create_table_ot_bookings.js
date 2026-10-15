
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ot_bookings", {
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

      patientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "patients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      surgeryNo: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      ipdAdmissionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "ipd_admissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      icuAdmissionId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "icu_admissions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      theatreId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "operating_theatres",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      procedureName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },

      specialty: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      estimatedDurationMinutes:{
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },

      scheduleDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      scheduledStartTime: {
        type: Sequelize.TIME,
        allowNull: true,
      },

      scheduledEndTime: {
        type: Sequelize.TIME,
        allowNull: true,
      },

      actualStartDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: null,
      },

      actualStartTime: {
        type: Sequelize.TIME,
        allowNull: true,
        defaultValue: null,
      },

      actualEndTime: {
        type: Sequelize.TIME,
        allowNull: true,
        defaultValue: null,
      },

      doctorId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      subDoctorId: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "sub_doctors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      doctorRole: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      priority: {
        type: Sequelize.ENUM("routine", "urgent", "emergency"),
        allowNull: false,
        defaultValue: "routine",
      },

      anaesthesia: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue:"General"
      },

      status: {
        type: Sequelize.ENUM(
          "requested",
          "scheduled",
          "in_progress",
          "completed",
          "cancelled",
          "postponed"
        ),
        allowNull: false,
        defaultValue: "requested",
      },

      disgnosis: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      requestedBy: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      requestedByRole: {
        type: Sequelize.STRING(50),
        allowNull: false,
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

    await queryInterface.addIndex(
      "ot_bookings",
      ["hospitalId", "theatreId", "scheduleDate", "scheduledStartTime"],
      {
        name: "ot_bookings_theatre_schedule_idx",
      }
    );


    await queryInterface.addIndex(
      "ot_bookings",
      ["hospitalId", "patientId"],
      {
        name: "ot_bookings_patient_idx",
      }
    );

    await queryInterface.addConstraint("ot_bookings", {
      fields: ["hospitalId", "surgeryNo"],
      type: "unique",
      name: "unique_hospital_surgery_no",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("ot_bookings");
  },
};
