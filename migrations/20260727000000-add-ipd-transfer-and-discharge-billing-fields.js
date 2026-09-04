"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("bed_transfers", "fromBedChargePerDay", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("bed_transfers", "toBedChargePerDay", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("ipd_discharges", "stayDays", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn("ipd_discharges", "bedCharge", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("ipd_discharges", "medicalCharges", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("ipd_discharges", "otherCharges", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ipd_discharges", "otherCharges");
    await queryInterface.removeColumn("ipd_discharges", "medicalCharges");
    await queryInterface.removeColumn("ipd_discharges", "bedCharge");
    await queryInterface.removeColumn("ipd_discharges", "stayDays");
    await queryInterface.removeColumn("bed_transfers", "toBedChargePerDay");
    await queryInterface.removeColumn("bed_transfers", "fromBedChargePerDay");
  },
};
