
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove diagnosis
    await queryInterface.removeColumn("ipd_discharges", "diagnosis");

    // 2. Rename summaryNotes -> dischargeNote
    await queryInterface.renameColumn(
      "ipd_discharges",
      "summaryNotes",
      "dischargeNote"
    );

    // 3. Add dischargeInitiateDate
    await queryInterface.addColumn(
      "ipd_discharges",
      "dischargeInitiateDate",
      {
        type: Sequelize.DATEONLY,
        allowNull: true,
        after:"dischargeNote",
      }
    );

    // 4. Modify status enum
    await queryInterface.changeColumn("ipd_discharges", "status", {
      type: Sequelize.ENUM(
        "Initiated",
        "Pending",
        "Discharged",
        "Cancelled"
      ),
      allowNull: false,
      defaultValue: "Initiated",
    });

    // 5. Remove invoiceId foreign key
    await queryInterface.removeConstraint(
      "ipd_discharges",
      "ipd_discharges_ibfk_3"
    );

    // Remove invoiceId index
    await queryInterface.removeIndex("ipd_discharges", "invoiceId");

    // Remove invoiceId column
    await queryInterface.removeColumn("ipd_discharges", "invoiceId");

    // Remove old stay and charge columns
    await queryInterface.removeColumn("ipd_discharges", "stayDays");

    await queryInterface.removeColumn("ipd_discharges", "bedCharge");

    await queryInterface.removeColumn("ipd_discharges", "medicalCharges");

    await queryInterface.removeColumn("ipd_discharges", "otherCharges");

    // 6. Remove doctorId foreign key
    await queryInterface.removeConstraint(
      "ipd_discharges",
      "ipd_discharges_ibfk_4"
    );

    // Remove doctorId/status index
    await queryInterface.removeIndex(
      "ipd_discharges",
      "ipd_discharges_doctor_id_status"
    );

    // Remove doctorId/dischargeId unique index
    await queryInterface.removeIndex(
      "ipd_discharges",
      "ipd_discharges_doctor_id_discharge_id_unique"
    );

    // Remove doctorId column
    await queryInterface.removeColumn("ipd_discharges", "doctorId");

    // 7. Add hospitalId
    await queryInterface.addColumn("ipd_discharges", "hospitalId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "patientId",
    });

    // 8. Add dischargeType
    await queryInterface.addColumn("ipd_discharges", "dischargeType", {
      type: Sequelize.ENUM(
        "Normal",
        "LAMA",
        "DAMA",
        "Transfer",
        "Death",
        "Other"
      ),
      allowNull: false,
      defaultValue: "Normal",
      after: "dischargeTime",
    });

    // 9. Add dischargeCondition
    await queryInterface.addColumn(
      "ipd_discharges",
      "dischargeCondition",
      {
        type: Sequelize.ENUM(
          "Stable",
          "Improved",
          "Unchanged",
          "Critical",
          "Expired"
        ),
        allowNull: true,
        after: "dischargeType",
        defaultValue:"Stable"
      }
    );

    // 10. Add followUpDate
    await queryInterface.addColumn("ipd_discharges", "followUpDate", {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: "dischargeCondition",
    });

    // 11. Add followUpInstructions
    await queryInterface.addColumn(
      "ipd_discharges",
      "followUpInstructions",
      {
        type: Sequelize.TEXT,
        allowNull: true,
        after: "followUpDate",
      }
    );

    // 12. Add hospitalId index
    await queryInterface.addIndex("ipd_discharges", ["hospitalId"], {
      name: "ipd_discharges_hospital_id",
    });

    // 13. Re-create unique dischargeId constraint per hospital
    await queryInterface.addIndex(
      "ipd_discharges",
      ["hospitalId", "dischargeId"],
      {
        unique: true,
        name: "ipd_discharges_hospital_id_discharge_id_unique",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove hospital/discharge indexes
    await queryInterface.removeIndex(
      "ipd_discharges",
      "ipd_discharges_hospital_id_discharge_id_unique"
    );

    await queryInterface.removeIndex(
      "ipd_discharges",
      "ipd_discharges_hospital_id"
    );

    // Remove newly added columns
    await queryInterface.removeColumn(
      "ipd_discharges",
      "followUpInstructions"
    );

    await queryInterface.removeColumn(
      "ipd_discharges",
      "followUpDate"
    );

    await queryInterface.removeColumn(
      "ipd_discharges",
      "dischargeCondition"
    );

    await queryInterface.removeColumn(
      "ipd_discharges",
      "dischargeType"
    );

    // Remove hospitalId foreign key and column
    await queryInterface.removeConstraint(
      "ipd_discharges",
      "ipd_discharges_ibfk_hospital_id"
    ).catch(() => {});

    await queryInterface.removeColumn("ipd_discharges", "hospitalId");

    // Restore doctorId
    await queryInterface.addColumn("ipd_discharges", "doctorId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      after: "patientId",
      references: {
        model: "doctors",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Restore doctorId/dischargeId unique index
    await queryInterface.addIndex(
      "ipd_discharges",
      ["doctorId", "dischargeId"],
      {
        unique: true,
        name: "ipd_discharges_doctor_id_discharge_id_unique",
      }
    );

    // Restore doctorId/status index
    await queryInterface.addIndex(
      "ipd_discharges",
      ["doctorId", "status"],
      {
        name: "ipd_discharges_doctor_id_status",
      }
    );

    // Restore invoiceId
    await queryInterface.addColumn("ipd_discharges", "invoiceId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "ipd_invoices",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex(
      "ipd_discharges",
      ["invoiceId"],
      {
        name: "invoiceId",
      }
    );

    // Restore old status enum
    await queryInterface.changeColumn("ipd_discharges", "status", {
      type: Sequelize.ENUM(
        "Pending",
        "Discharged",
        "Cancelled"
      ),
      allowNull: false,
      defaultValue: "Discharged",
    });

    // Remove dischargeInitiateDate
    await queryInterface.removeColumn(
      "ipd_discharges",
      "dischargeInitiateDate"
    );

    // Rename dischargeNote -> summaryNotes
    await queryInterface.renameColumn(
      "ipd_discharges",
      "dischargeNote",
      "summaryNotes"
    );

    // Restore diagnosis
    await queryInterface.addColumn("ipd_discharges", "diagnosis", {
      type: Sequelize.TEXT,
      allowNull: false,
    });

    // Restore old billing/stay fields
    await queryInterface.addColumn("ipd_discharges", "stayDays", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn("ipd_discharges", "bedCharge", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    });

    await queryInterface.addColumn("ipd_discharges", "medicalCharges", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    });

    await queryInterface.addColumn("ipd_discharges", "otherCharges", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    });
  },
};
