const { Op } = require("sequelize");

const {
  IntakeAndOutput,
  IPDAdmission,
  ICUAdmission,
  Patient,
  Receptionist,
  Doctor,
  SubDoctor,
  sequelize
} = require("../models");

const { decrypt } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

const decryptSafe = (value) => {
  if (!value) return value;
  try {
    return decrypt(value);
  } catch (error) {
    console.error("DECRYPT FAILED:", error.message, "| raw value:", value);
    return value;
  }
};

exports.addIntakeAndOutput = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      ipdAdmissionId,
      icuAdmissionId,
      patientId,
      category,
      type,
      quantity,
      date,
      time,
      remarks,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    if (!category || !["intake", "output"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Category must be either intake or output",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type is required",
      });
    }

    if (!quantity) {
      return res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    if (!time) {
      return res.status(400).json({
        success: false,
        message: "Time is required",
      });
    }

    if (!ipdAdmissionId && !icuAdmissionId) {
      return res.status(400).json({
        success: false,
        message: "Admission ID is required",
      });
    }

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        doctorId: hospitalId,
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    let ipdAdmission = null;

    if (ipdAdmissionId) {
      ipdAdmission = await IPDAdmission.findOne({
        where: {
          id: ipdAdmissionId,
          hospitalId: hospitalId,
          patientId: patientId,
        },
      });

      if (!ipdAdmission) {
        return res.status(404).json({
          success: false,
          message: "IPD admission not found for this patient",
        });
      }

      if (["discharged", "cancelled", "absconded"].includes(ipdAdmission.status)) {
        return res.status(404).json({
          success: false,
          message: `IPD admission is already ${ipdAdmission.status}, so cannot add intake/output records`,
        });
      }
    }

    let icuAdmission = null;

    if (icuAdmissionId) {
      icuAdmission = await ICUAdmission.findOne({
        where: {
          id: icuAdmissionId,
          hospitalId: hospitalId,
          patientId: patientId,
        },
      });

      if (!icuAdmission) {
        return res.status(404).json({
          success: false,
          message: "ICU admission not found for this patient",
        });
      }

      if (icuAdmission.status !== "ACTIVE") {
        return res.status(404).json({
          success: false,
          message: "ICU admission not active",
        });
      }

      if (
        ipdAdmissionId &&
        icuAdmission.ipdAdmissionId &&
        Number(ipdAdmissionId) !== Number(icuAdmission.ipdAdmissionId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The provided IPD admission does not match the ICU admission",
        });
      }
    }

    const recordedBy =
      ["doctor", "subDoctor"].includes(req.user.role) 
        ? req.user.id
        : req.user.receptionistId;
        
    const recordedByRole = req.user.role;

    if (!recordedBy) {
      return res.status(400).json({
        success: false,
        message: "Unable to identify the user who recorded the intake/output",
      });
    }

    const intakeAndOutput = await IntakeAndOutput.create({
      hospitalId,

      ipdAdmissionId: ipdAdmissionId || null,
      icuAdmissionId: icuAdmissionId || null,

      patientId,
      patientUniqueId:patient.patientId,

      category,
      type,
      quantity,

      date,
      time,

      remarks: remarks || null,

      recordedBy,
      recordedByRole,
    });

    return res.status(201).json({
      success: true,
      message: `${
        category === "intake" ? "Intake" : "Output"
      } record added successfully`,
      data: intakeAndOutput,
    });
  } catch (error) {
    console.error("Add Intake/Output Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add intake/output record",
      error: error.message,
    });
  }
};

exports.getIntakeAndOutputData = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    // const { patientId } = req.params;

    const {
      date,
      ipdAdmissionId,
      icuAdmissionId,
      category,
      patientId,
    } = req.query;

    if (patientId) {
      const patient = await Patient.findOne({
        where: {
          id: patientId,
          doctorId: hospitalId,
        },
        attributes: ["id", "patientId", "name"],
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }
    }

    if (icuAdmissionId) {
      const icuAdmission = await ICUAdmission.findOne({
        where: {
          id: icuAdmissionId,
          hospitalId,
          ...(patientId ? { patientId } : {}),
        },
      });

      if (!icuAdmission) {
        return res.status(404).json({
          success: false,
          message: "ICU admission not found",
        });
      }
    }

    if (ipdAdmissionId) {
      const ipdAdmission = await IPDAdmission.findOne({
        where: {
          id: ipdAdmissionId,
          hospitalId,
          ...(patientId ? { patientId } : {}),
        },
      });

      if (!ipdAdmission) {
        return res.status(404).json({
          success: false,
          message: "IPD admission not found",
        });
      }
    }

    const where = {
      hospitalId,
    };

    const filterDate = date || null;

    if (filterDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
        return res.status(400).json({
          success: false,
          message: "Date must be in YYYY-MM-DD format",
        });
      }

      where.date = filterDate;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    if (ipdAdmissionId) {
      where.ipdAdmissionId = ipdAdmissionId;
    }

    if (icuAdmissionId) {
      where.icuAdmissionId = icuAdmissionId;
    }

    if (category && !["intake", "output"].includes(category)) {
    return res.status(400).json({
        success: false,
        message: "Category must be either intake or output",
    });
    }

    if (category) {
      where.category = category;
    }

    const intakeAndOutput = await IntakeAndOutput.findAll({
      where,
      include:[
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "patientId", "name"],
        },
        {
          model: ICUAdmission,
          as: "icuAdmission",
          attributes: [
            "id",
            "icuAdmissionNumber",
            "patientId",
            "admissionDate",
            "admissionTime",
            "status",
          ],
        },
        {
          model: IPDAdmission,
          as: "ipdAdmission",
          attributes: [
            "id",
            "admissionNumber",
            "patientId",
            "admissionDate",
            "status",
          ],
        },
      ],
      order: [
        ["date", "ASC"],
        ["time", "ASC"],
      ],
    });

    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    intakeAndOutput.forEach((data) => {
      if (!data.recordedBy) return;

      if (data.recordedByRole === "doctor") {
        doctorIds.push(data.recordedBy);
      }else if (data.recordedByRole === "subDoctor") {
        subDoctorIds.push(data.recordedBy);
      }else {
        receptionistIds.push(data.recordedBy);
      }
    });

    const uniqueDoctorIds = [...new Set(doctorIds)];
    const uniqueSubDoctorIds = [...new Set(subDoctorIds)];
    const uniqueReceptionistIds = [...new Set(receptionistIds)];


    const doctors = uniqueDoctorIds.length
    ? await Doctor.findAll({
        where: {
          id: uniqueDoctorIds,
        },
        attributes: ["id", "name", "email"],
      })
    : [];

    const subDoctors = uniqueSubDoctorIds.length
     ? await SubDoctor.findAll({
      where: {
        id: uniqueSubDoctorIds,
      },
      attributes: ["id", "name", "email"],
    })
    : [];;

    const receptionists = uniqueReceptionistIds.length
    ? await Receptionist.findAll({
      where: {
        receptionistId: uniqueReceptionistIds 
      },
      attributes: ["id", "name", "email", "receptionistId"],
    })
    : [];

    const doctorMap = new Map(
      doctors.map((doctor) => [
        doctor.id,
        {
          id: doctor.id,
          name: decryptSafe(doctor.name),
          email: doctor.email,
        },
      ])
    );

    const subDoctorMap = new Map(
      subDoctors.map((subDoctor) => [
        subDoctor.id,
        {
          id: subDoctor.id,
          name: decryptSafe(subDoctor.name),
          email: subDoctor.email,
        },
      ])
    );

    const receptionistMap = new Map(
      receptionists.map((receptionist) => [
        receptionist.receptionistId,
        {
          id: receptionist.id,
          name: decryptSafe(receptionist.name),
          email: receptionist.email,
          receptionistId: receptionist.receptionistId,
        },
      ])
    );

    const formattedIntakeAndOutput = intakeAndOutput.map((data) => {
      const intakeAndOutputData = data.toJSON();

      let recordedByDetails = null;

      if (data.recordedByRole === "doctor") {
        recordedByDetails =
           doctorMap.get(Number(data.recordedBy)) || null;
      } else if (data.recordedByRole === "subDoctor") {
        recordedByDetails =
          subDoctorMap.get(data.recordedBy) || null;
      }else {
        recordedByDetails =
          receptionistMap.get(data.recordedBy) || null;
      }

      let patient = null;

      if (data.patient) {
        const patientData = data.patient.toJSON();

        patient = {
          id: patientData.id,
          patientId: patientData.patientId,
          name: decryptSafe(patientData.name),
        };
      }

      let icuAdmission = null;

      if (data.icuAdmission) {
        const icuData = data.icuAdmission.toJSON();

        icuAdmission = {
          id: icuData.id,
          icuAdmissionNumber: icuData.icuAdmissionNumber,
          patientId: icuData.patientId,
          admissionDate: icuData.admissionDate,
          admissionTime: icuData.admissionTime,
          status: icuData.status,
        };
      }


      let ipdAdmission = null;

      if (data.ipdAdmission) {
        const ipdData = data.ipdAdmission.toJSON();

        ipdAdmission = {
          id: ipdData.id,
          admissionNumber: ipdData.admissionNumber,
          patientId: ipdData.patientId,
          admissionDate: ipdData.admissionDate,
          status: ipdData.status,
        };
      }

      return {
        ...intakeAndOutputData,
        recordedByDetails,
        patient,
        icuAdmission,
        ipdAdmission,
      };
    });


    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      intakeAndOutput: formattedIntakeAndOutput,
    });
  } catch (error) {
    console.error("Get Intake/Output by patient error:", error);

    return res.status(500).json({
      success: false,
     message: error.message || "Failed to fetch intake/output records",
    });
  }
};

exports.deleteIntakeAndOutput = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Intake/Output Id is required",
      });
    }

    const intakeAndOutput = await IntakeAndOutput.findOne({
      where: {
        id,
        hospitalId,
      },
    });

    if (!intakeAndOutput) {
      return res.status(404).json({
        success: false,
        message: "Intake/Output record not found",
      });
    }

    await intakeAndOutput.destroy();

    return res.status(200).json({
      success: true,
      message: "Intake/Output deleted successfully",
    });
  } catch (error) {
    console.error("Delete Intake/Output error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete Intake/Output",
    });
  }
};

exports.getLatestIntakeAndOutput = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { searchTerm,category,date } = req.query;

    const intakeAndOutput = await IntakeAndOutput.findAll({
      where: {
        hospitalId,
        icuAdmissionId: {
          [Op.ne]: null,
        },
        ...(category ? { category } : {}),
        ...(date ? { date } : {}),
      },
      include:[
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "patientId", "name","mobileNumber","gender","age","email"],
        },
        {
          model: ICUAdmission,
          as: "icuAdmission",
          attributes: [
            "id",
            "icuAdmissionNumber",
            "patientId",
            "admissionDate",
            "admissionTime",
            "status",
          ],
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    let filteredData = intakeAndOutput.map((item) => {
      const data = item.toJSON();

      if (data.patient) {
        data.patient.name = data.patient.name
          ? decrypt(data.patient.name)
          : "";

        data.patient.email = data.patient.email
          ? decrypt(data.patient.email)
          : "";

        data.patient.mobileNumber = data.patient.mobileNumber
          ? decrypt(data.patient.mobileNumber)
          : "";
      }

      return data;
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      filteredData = filteredData.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;

        return (
          patient?.name
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.patientId
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.mobileNumber
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.email
            ?.toLowerCase()
            .includes(keyword) ||

          admission?.icuAdmissionNumber
            ?.toLowerCase()
            .includes(keyword) 
        );
      });
    }

    const latestIntakeAndOutputMap = new Map();

    filteredData.forEach((data) => {
      const key = `${data.patientId}_${data.icuAdmissionId}`;

      if (!latestIntakeAndOutputMap.has(key)) {
        latestIntakeAndOutputMap.set(key, data);
      }
    });

    const latestIntakeAndOutput = Array.from(
      latestIntakeAndOutputMap.values()
    );

    return res.status(200).json({
      success: true,
      message: "ICU Intake And Output fetched successfully",
      data: latestIntakeAndOutput,
    });
  } catch (error) {
    console.error("Get Latest ICU Intake And Output Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ICU Intake And Output",
    });
  }
};

