const { max_sub_doctor } = require("../config/config");
const { SubDoctor, Doctor, Receptionist, Appointment, DoctorTimeSlot } = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const { transformWithMapping } = require("../utils/transformWithMapping");
const { decrypt } = require("../utils/cryptography");
const { validateQueryParams } = require("../utils/validateQueryParams");
const moment = require("moment-timezone");
const { transliterate } = require("transliteration");

const generateUniqueDoctorId = async (name) => {
  const englishName = transliterate(name);

  const nameParts = englishName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = nameParts
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);

    uniqueId = `${initials}${randomDigits}`;

    const existingDoctor = await SubDoctor.findOne({
      where: { id: uniqueId },
    });

    if (!existingDoctor) {
      isUnique = true;
    }
  }

  return uniqueId;
};

// const generateUniqueDoctorId = async (name) => {
//   const nameParts = name.split(" ");
//   const initials = nameParts
//     .map((part) => part.charAt(0))
//     .join("")
//     .toUpperCase();

//   let uniqueId;
//   let isUnique = false;

//   while (!isUnique) {
//     const randomDigits = Math.floor(10000 + Math.random() * 90000);
//     uniqueId = `${initials}${randomDigits}`;

//     const existingDoctor = await SubDoctor.findOne({
//       where: { id: uniqueId },
//     });

//     if (!existingDoctor) {
//       isUnique = true;
//     }
//   }

//   return uniqueId;
// };

exports.createSubDoctor = async (req, res) => {
  try {
    const {
      name,
      email,
      mobileNumber,
      alternateMobileNumber,
      gender,
      specialization,
      qualification,
      experience,
      dateOfBirth,
      address,
      city,
      state,
      country,
      pinCode,
      password,
      department,
    } = req.body;

    let isExists;
    isExists = await Doctor.findOne({ where: { email } });
    if (!isExists) {
      isExists = await SubDoctor.findOne({
        where: { email },
      });
    }
    if (!isExists) {
      isExists = await Receptionist.findOne({
        where: { email },
      });
    }

    if (isExists) {
      return res
        .status(400)
        .json({ error: "Email is already registered with another user." });
    }

    // const planLimit = await checkPlanLimit({
    //   hospitalId: req.user.hospitalId,
    //   resource: "doctors",
    // });

    // if (!planLimit.allowed) {
    //   return res.status(planLimit.status).json(planLimit.response);
    // }

    // const subDoctorCount = await SubDoctor.count({
    //   where: {
    //     addedBy: req.user.hospitalId,
    //   },
    // });

    // if (subDoctorCount >= max_sub_doctor) {
    //   return res.status(400).json({
    //     error: `You can't add more than ${max_sub_doctor} sub-doctors.`,
    //   });
    // }

    const files = req.files || {};
    const profile = files.profile
      ? `data:${
          files.profile[0].mimetype
        };base64,${files.profile[0].buffer.toString("base64")}`
      : null;
    const idProof = files.idProof
      ? `data:${
          files.idProof[0].mimetype
        };base64,${files.idProof[0].buffer.toString("base64")}`
      : null;

    const doctor = await Doctor.findOne({
      where: { id: req.user.hospitalId },
      attributes: ["mapping"],
    });

    let mappingObj = {};
    if (doctor && doctor.mapping) {
      try {
        const decrypted = decrypt(doctor.mapping);
        mappingObj = decrypted ? JSON.parse(decrypted) : {};
      } catch (e) {
        mappingObj = {};
      }
    }

    const nameSearch = transformWithMapping(name, mappingObj);
    const mobileSearch = transformWithMapping(mobileNumber, mappingObj);

    const uniqueId = await generateUniqueDoctorId(name);
    const hashedPassword = await bcrypt.hash(password, 10);
    const subDoctor = await SubDoctor.create({
      id: uniqueId,
      addedBy: req.user.id,
      name,
      email,
      mobileNumber,
      alternateMobileNumber,
      gender,
      specialization,
      department,
      qualification,
      experience,
      dateOfBirth,
      address,
      city,
      state,
      country,
      pinCode,
      profile,
      idProof,
      nameSearch,
      mobileSearch,
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      message: "Sub doctor created successfully",
      data: {
        ...subDoctor.toJSON(),
        profile: files.profile
          ? `data:${
              files.profile[0].mimetype
            };base64,${files.profile[0].buffer.toString("base64")}`
          : null,
        idProof: files.idProof
          ? `data:${
              files.idProof[0].mimetype
            };base64,${files.idProof[0].buffer.toString("base64")}`
          : null,
      },
    });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({
      success: false,
      error: "Error creating sub doctor",
    });
  }
};

exports.getAllSubDoctors = async (req, res) => {
  try {
    const { page, limit, offset, searchTerm } = validateQueryParams({
      ...req.query,
    });
    const { isActive,departmentFilter } = req.query;
    let whereClause = { addedBy: req.user.id };

    if (searchTerm && searchTerm.length > 0) {
      const doctor = await Doctor.findOne({
        where: { id: req.user.hospitalId },
        attributes: ["mapping"],
      });

      let searchMapping = {};
      if (doctor && doctor.mapping) {
        try {
          const decrypted = decrypt(doctor.mapping);
          searchMapping = decrypted ? JSON.parse(decrypted) : {};
        } catch (e) {
          searchMapping = {};
        }
      }

      const transformSearchTerm = transformWithMapping(
        searchTerm,
        searchMapping
      );

      whereClause[Op.or] = [
        { nameSearch: { [Op.like]: `%${transformSearchTerm}%` } },
        { mobileSearch: { [Op.like]: `%${transformSearchTerm}%` } },
      ];
    }

    if (isActive === "true" || isActive === "false") {
      whereClause.isActive = isActive === "true";
    }

    if(departmentFilter){
      whereClause.department=departmentFilter;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const subDoctors = await SubDoctor.findAndCountAll({
      where: whereClause,
      attributes: [
        "id",
        "name",
        "email",
        "mobileNumber",
        "specialization",
        "qualification",
        "isActive",
        "createdAt",
        "department",
        "prescriptionDisplay",
      ],
      include: [
        {
          model: DoctorTimeSlot,
          as: "slots",
          attributes: ["id", "slotName", "startTime", "endTime"],
        },
        {
          model: Appointment,
          as: "appointments",
          attributes: ["id"],
          where: {
            date: {
              [Op.between]: [startOfDay, endOfDay],
            },
          },
          required: false,
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: subDoctors.rows,
      pagination: {
        totalRecords: subDoctors.count,
        totalPages: Math.ceil(subDoctors.count / limit),
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error fetching sub doctors",
    });
  }
};

exports.getSubDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const subDoctor = await SubDoctor.findByPk(id);

    if (!subDoctor) {
      return res.status(404).json({
        success: false,
        error: "Sub doctor not found",
      });
    }

    // Doctor can access SubDoctors added by that doctor
    if (
      req.user.role === "doctor" &&
      String(subDoctor.addedBy) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    // SubDoctor can access only their own profile
    if (
      req.user.role === "subDoctor" &&
      String(subDoctor.id) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return res.status(200).json({
      success: true,
      data: subDoctor,
    });
  } catch (error) {
    console.error("getSubDoctorById error:", error);

    return res.status(500).json({
      success: false,
      error: "Error fetching sub doctor",
    });
  }
};

exports.updateSubDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      mobileNumber,
      alternateMobileNumber,
      gender,
      specialization,
      qualification,
      experience,
      dateOfBirth,
      address,
      city,
      state,
      country,
      pinCode,
      department,
    } = req.body;

    const subDoctor = await SubDoctor.findByPk(id);
    if (!subDoctor) {
      return res.status(404).json({
        success: false,
        error: "Sub doctor not found",
      });
    }

    if (subDoctor.addedBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to update this sub doctor",
      });
    }

    if (email && email !== subDoctor.email) {
      const existingSubDoctor = await SubDoctor.findOne({ where: { email } });
      if (existingSubDoctor) {
        return res.status(409).json({
          success: false,
          error: "Sub doctor with this email already exists",
        });
      }
    }

    if (mobileNumber && mobileNumber !== subDoctor.mobileNumber) {
      const existingSubDoctor = await SubDoctor.findOne({
        where: { mobileNumber },
      });
      if (existingSubDoctor) {
        return res.status(409).json({
          success: false,
          error: "Sub doctor with this mobile number already exists",
        });
      }
    }

    const doctor = await Doctor.findOne({
      where: { id: req.user.hospitalId },
      attributes: ["mapping"],
    });

    let updateMapping = {};
    if (doctor && doctor.mapping) {
      try {
        const decrypted = decrypt(doctor.mapping);
        updateMapping = decrypted ? JSON.parse(decrypted) : {};
      } catch (e) {
        updateMapping = {};
      }
    }

    const nameSearch = transformWithMapping(name, updateMapping);
    const mobileSearch = transformWithMapping(mobileNumber, updateMapping);

    const files = req.files || {};
    const updateData = {
      name,
      nameSearch,
      email,
      mobileNumber,
      mobileSearch,
      alternateMobileNumber,
      gender,
      specialization,
      qualification,
      experience,
      dateOfBirth,
      address,
      city,
      state,
      country,
      pinCode,
      department,
    };

    if (files.profile)
      updateData.profile = `data:${
        files.profile[0].mimetype
      };base64,${files.profile[0].buffer.toString("base64")}`;
    if (files.idProof)
      updateData.idProof = `data:${
        files.idProof[0].mimetype
      };base64,${files.idProof[0].buffer.toString("base64")}`;

    await subDoctor.update(updateData);

    res.status(200).json({
      success: true,
      error: "Sub doctor updated successfully",
      data: {
        ...subDoctor.toJSON(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error updating sub doctor",
    });
  }
};

exports.deleteSubDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    const subDoctor = await SubDoctor.findByPk(id);
    if (!subDoctor) {
      return res.status(404).json({
        success: false,
        error: "Sub doctor not found",
      });
    }

    if (subDoctor.addedBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to delete this sub doctor",
      });
    }

    await subDoctor.destroy();

    res.json({
      success: true,
      error: "Sub doctor deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error deleting sub doctor",
    });
  }
};

exports.toggleSubDoctorStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const subDoctor = await SubDoctor.findByPk(id, {
      attributes: ["id", "isActive", "addedBy"],
    });
    if (!subDoctor) {
      return res.status(404).json({
        success: false,
        error: "Sub doctor not found",
      });
    }

    if (subDoctor.addedBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to toggle the status of this sub doctor",
      });
    }

    await subDoctor.update({ isActive: !subDoctor.isActive });

    res.status(200).json({
      success: true,
      error: `Sub doctor ${
        subDoctor.isActive ? "activated" : "deactivated"
      } successfully`,
      data: { isActive: subDoctor.isActive },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error toggling sub doctor status",
    });
  }
};

exports.addSignature = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  try {
    const doctor = await SubDoctor.findByPk(req.user.id, {
      attributes: ["id", "signature"],
    });

    doctor.signature = `data:${
      req.file.mimetype
    };base64,${req.file.buffer.toString("base64")}`;

    await doctor.save();

    res.status(200).json({
      success: true,
      message: "Signature added successfully",
      signature: `data:${req.file.mimetype};base64,${req.file.buffer.toString(
        "base64"
      )}`,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to upload signature" });
  }
};

exports.stats = async (req, res) => {
  try {
    const [
      totalDoctorsCount,
      activeDoctorsCount,
      patientCount,
      specializationCount,
    ] = await Promise.all([
      SubDoctor.count({
        where: {
          addedBy: req.user.hospitalId,
        },
      }),
      SubDoctor.count({
        where: {
          isActive: true,
          addedBy: req.user.hospitalId,
        },
      }),
      Appointment.count({
        where: {
          status: "out",
          subDoctorId: {
            [Op.not]: null,
          },
          date: {
            [Op.between]: [
              moment().tz("Asia/Kolkata").startOf("day").toDate(),
              moment().tz("Asia/Kolkata").endOf("day").toDate(),
            ],
          },
        },
      }),
      SubDoctor.count({
        where: {
          addedBy: req.user.hospitalId,
        },
        col: "specialization",
        unique: true,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalDoctorsCount,
        activeDoctorsCount,
        patientCount,
        specializationCount,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ success: false, error: "Failed to get stats" });
  }
};

exports.getPrescriptionSubDoctors = async (req, res) => {
  try {
    const { department } = req.query;
    const hospitalId = req.user.hospitalId;

    console.log("department:", department);

    if (!department) {
      return res.status(200).json({
        success: true,
        message: "Department not provided",
        data: [],
      });
    }

    const doctor = await Doctor.findOne({
      where: {
        id:hospitalId,
        department,
        prescriptionDisplay: {
          [Op.gt]: 0,
        },
      },
      attributes: [
        "id",
        "name",
        "email",
        "mobileNumber",
        "specialization",
        "department",
        "medicalDegree",
        "prescriptionDisplay",
      ],
    });

    const subDoctors = await SubDoctor.findAll({
      where: {
        addedBy:hospitalId,
        department,
        prescriptionDisplay: {
          [Op.gt]: 0,
        },
        isActive: 1,
      },
      attributes: [
        "id",
        "name",
        "email",
        "mobileNumber",
        "specialization",
        "department",
        "qualification",
        "prescriptionDisplay",
      ],
    });

    const doctorsList = [];

    if (doctor) {
      const doctorData = doctor.toJSON();

      doctorsList.push({
        id: doctorData.id,
        name: doctorData.name,
        email: doctorData.email,
        mobileNumber: doctorData.mobileNumber,
        specialization: doctorData.specialization,
        department: doctorData.department,
        qualification: doctorData.medicalDegree,
        prescriptionDisplay: doctorData.prescriptionDisplay,
        doctorType: "doctor",
      });
    }

  
    subDoctors.forEach((subDoctor) => {
      const subDoctorData = subDoctor.toJSON();

      doctorsList.push({
        id: subDoctorData.id,
        name: subDoctorData.name,
        email: subDoctorData.email,
        mobileNumber: subDoctorData.mobileNumber,
        specialization: subDoctorData.specialization,
        department: subDoctorData.department,
        qualification: subDoctorData.qualification,
        prescriptionDisplay: subDoctorData.prescriptionDisplay,
        doctorType: "subDoctor",
      });
    });

    doctorsList.sort(
      (a, b) => a.prescriptionDisplay - b.prescriptionDisplay
    );

    return res.status(200).json({
      success: true,
      message: "Prescription doctors fetched successfully",
      data: doctorsList,
    });
  } catch (error) {
    console.error("Get prescription doctors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescription doctors",
      error: error.message,
    });
  }
};

exports.togglePrescriptionDisplay = async (req, res) => {
  try {
    const { subDoctorId } = req.body;

    const mainDoctorDepartment = req.user.department;

    if (!subDoctorId) {
      return res.status(400).json({
        success: false,
        message: "Sub Doctor ID is required.",
      });
    }

    const mainDoctor = await Doctor.findByPk(req.user.id, {
      attributes: ["id", "department"],
    });

    if (!mainDoctor) {
      return res.status(404).json({
        success: false,
        message: "Main doctor not found.",
      });
    }

    // Selected Sub Doctor
    const subDoctor = await SubDoctor.findByPk(subDoctorId, {
      attributes: [
        "id",
        "department",
        "prescriptionDisplay",
      ],
    });

    if (!subDoctor) {
      return res.status(404).json({
        success: false,
        message: "Sub Doctor not found.",
      });
    }


    //   CASE 1: Already displayed -> REMOVE

    if (subDoctor.prescriptionDisplay > 0) {
      const department = subDoctor.department;

      // Remove from prescription

      await subDoctor.update(
        {
          prescriptionDisplay: 0,
        },
        {
          where: {
            id: subDoctor.id,
          },
          hooks: false,
        }
      );


      const isMainDoctorDepartment = mainDoctorDepartment === department;

      const startPosition = isMainDoctorDepartment ? 2 : 1;

      const remainingSubDoctors = await SubDoctor.findAll({
        where: {
          department,
          prescriptionDisplay: {
            [Op.gt]: 0,
          },
        },
        order: [["prescriptionDisplay", "ASC"]],
      });

      // Resequence
      for (let index = 0; index < remainingSubDoctors.length; index++) {
        await SubDoctor.update(
          {
            prescriptionDisplay: startPosition + index,
          },
          {
            where: {
              id: remainingSubDoctors[index].id,
            },
            hooks: false, // Skip beforeUpdate hook
          }
        );
      }

      return res.status(200).json({
        success: true,
        action: "removed",
        message: "Sub Doctor removed from prescription display.",
        data: {
          subDoctorId: subDoctor.id,
          prescriptionDisplay: 0,
        },
      });
    }

    // CASE 2: Not displayed -> ADD
    

    const department = subDoctor.department;

  
    const isMainDoctorDepartment = mainDoctorDepartment === department;

    const maxSubDoctors = isMainDoctorDepartment ? 2 : 3;

    const startPosition = isMainDoctorDepartment ? 2 : 1;

    const existingSubDoctors = await SubDoctor.findAll({
      where: {
        department,
        prescriptionDisplay: {
          [Op.gt]: 0,
        },
      },
      attributes: ["id", "prescriptionDisplay"],
      order: [["prescriptionDisplay", "ASC"]],
    });

    if (existingSubDoctors.length >= maxSubDoctors) {
      return res.status(400).json({
        success: false,
        action: "limit",
        message: `Maximum ${maxSubDoctors} sub doctors can be displayed for this department.`,
      });
    }


    const usedPositions = existingSubDoctors
      .map((item) => Number(item.prescriptionDisplay))
      .filter((position) => position > 0);

    let assignedPosition = null;

    for (
      let position = startPosition;
      position < startPosition + maxSubDoctors;
      position++
    ) {
      if (!usedPositions.includes(position)) {
        assignedPosition = position;
        break;
      }
    }

    if (!assignedPosition) {
      return res.status(400).json({
        success: false,
        message: "No prescription display position available.",
      });
    }

    // Assign position
    await subDoctor.update({
      prescriptionDisplay: assignedPosition,
    });

    return res.status(200).json({
      success: true,
      action: "added",
      message: "Sub Doctor added to prescription display.",
      data: {
        subDoctorId: subDoctor.id,
        prescriptionDisplay: assignedPosition,
      },
    });
  } catch (error) {
    console.error("togglePrescriptionDisplay error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
