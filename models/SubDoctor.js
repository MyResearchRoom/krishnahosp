const { Model } = require("sequelize");
const { encrypt, decrypt } = require("../utils/cryptography");

function getAge(dateOfBirth) {
  if (dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }
  return null;
}

module.exports = (sequelize, DataTypes) => {
  class SubDoctor extends Model {
    static associate(models) {
      SubDoctor.belongsTo(models.Doctor, {
        foreignKey: "addedBy",
        as: "doctor",
      });
      SubDoctor.hasMany(models.Appointment, {
        foreignKey: "subDoctorId",
        as: "appointments",
      });
      SubDoctor.hasMany(models.DoctorTimeSlot, {
        foreignKey: "subDoctorId",
        as: "slots",
      });
    }
  }

  SubDoctor.init(
    {
      addedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nameSearch: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mobileSearch: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      alternateMobileNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gender: {
        type: DataTypes.ENUM("male", "female", "other"),
        allowNull: false,
      },
      specialization: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      department: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      prescriptionDisplay: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      
      qualification: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      experience: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dateOfBirth: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pinCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      profile: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      idProof: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      signature: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },
      medicalRegistrationCertificate: {
        type: DataTypes.BLOB("long"),
        allowNull: true,
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otpExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "SubDoctor",
      tableName: "sub_doctors",
      timestamps: true,
      paranoid: true,
    }
  );

  const ENCRYPT_FIELDS = [
    "name",
    "mobileNumber",
    "alternateMobileNumber",
    "address",
    "dateOfBirth",
    "specialization",
    "signature",
    "profile",
    "idProof",
  ];

  SubDoctor.addHook("beforeCreate", (doctor) => encryptFields(doctor));
  SubDoctor.addHook("beforeUpdate", (doctor) => encryptFields(doctor));

  function encryptFields(instance) {
    ENCRYPT_FIELDS.forEach((field) => {
      if (instance[field]) {
        instance[field] = encrypt(instance[field]);
      }
    });
  }

  SubDoctor.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    ENCRYPT_FIELDS.forEach((field) => {
      if (values[field]) {
        if (field !== "profile" && field !== "signature") {
          values[field] = decrypt(values[field]);
        }
        if (field === "dateOfBirth")
          values["age"] = getAge(values["dateOfBirth"]);
      }
    });

    delete values.password;
    return values;
  };

  return SubDoctor;
};
