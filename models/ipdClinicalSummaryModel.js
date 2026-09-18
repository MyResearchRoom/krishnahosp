module.exports = (sequelize, DataTypes) => {
  const IPDClinicalSummary = sequelize.define(
    "IPDClinicalSummary",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      admissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      doctorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      attendingDoctorId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attendingDoctorType: {
        type: DataTypes.ENUM("doctor", "subDoctor"),
        allowNull: false,
        defaultValue: "doctor",
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      heading: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("Stable", "Under Treatment", "Critical"),
        allowNull: false,
        defaultValue: "Stable",
      },
    },
    {
      tableName: "ipd_clinical_summaries",
      timestamps: true,
    }
  );

  IPDClinicalSummary.associate = (models) => {
    IPDClinicalSummary.belongsTo(models.IPDAdmission, {
      foreignKey: "admissionId",
      as: "admission",
    });
    IPDClinicalSummary.belongsTo(models.Patient, {
      foreignKey: "patientId",
      as: "patient",
    });
  };

  return IPDClinicalSummary;
};