const { Op } = require("sequelize");
const {
  Vitals,
  IPDAdmission,
  ICUAdmission,
  Patient,
  Receptionist,
  Doctor,
  SubDoctor,
  sequelize
} = require("../models");

const { decrypt, getDecryptedDocumentAsBase64 } = require("../utils/cryptography");

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

exports.addVitals = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const {
      ipdAdmissionId,
      icuAdmissionId,
      patientId,
      recordedAtDate,
      recordedAtTime,
      temperature,
      pulse,
      insulin,
      bp,
      spo2,
      bsl,
      respiratoryRate,
      notes,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "patientId is required",
      });
    }

    if (!recordedAtDate) {
      return res.status(400).json({
        success: false,
        message: "recordedAtDate is required",
      });
    }

    if (!recordedAtTime) {
      return res.status(400).json({
        success: false,
        message: "recordedAtTime is required",
      });
    }

    if (!ipdAdmissionId && !icuAdmissionId) {
      return res.status(400).json({
        success: false,
        message: "AdmissionId is required",
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
          message: `IPD admission is already ${ipdAdmission.status}, so cannot add vitals record`,
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
        message: "Unable to identify the user who recorded the vitals",
      });
    }

    const vitals = await Vitals.create({
      hospitalId,

      ipdAdmissionId: ipdAdmissionId || null,
      icuAdmissionId: icuAdmissionId || null,
      patientId,
      patientUniqueId:patient.patientId,
      recordedAtDate,
      recordedAtTime,

      temperature:
        temperature !== undefined && temperature !== ""
          ? temperature
          : null,

      pulse:
        pulse !== undefined && pulse !== ""
          ? pulse
          : null,

      bp: bp !== undefined && bp !== ""
          ? bp
          : null,


      spo2:
        spo2 !== undefined && spo2 !== ""
          ? spo2
          : null,

      bsl:
        bsl !== undefined && bsl !== ""
          ? bsl
          : null,

      insulin:
        insulin !== undefined && insulin !== ""
          ? insulin
          : null,

      respiratoryRate:
        respiratoryRate !== undefined && respiratoryRate !== ""
          ? respiratoryRate
          : null,

      notes: notes || null,

      recordedBy,
      recordedByRole,
    });
    

    return res.status(201).json({
      success: true,
      message: "Vitals added successfully",
      data: vitals,
    });
  } catch (error) {
    console.error("Add vitals error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add vitals",
    });
  }
};

exports.getVitals = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      recordedAtDate,
      ipdAdmissionId,
      icuAdmissionId,
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

    if (patientId) {
      where.patientId = patientId;
    }

    const filterDate = recordedAtDate || null;

    if (filterDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
        return res.status(400).json({
          success: false,
          message: "Date must be in YYYY-MM-DD format",
        });
      }

      where.recordedAtDate = filterDate;
    }

    // if (ipdAdmissionId) {
    //   where.ipdAdmissionId = ipdAdmissionId;
    // }

    // if (icuAdmissionId) {
    //   where.icuAdmissionId = icuAdmissionId;

    // }

    if (icuAdmissionId && ipdAdmissionId) {
      where[Op.or] = [
        {
          icuAdmissionId: icuAdmissionId,
          ipdAdmissionId: {
            [Op.is]: null,
          },
        },
        {
          icuAdmissionId: {
            [Op.is]: null,
          },
          ipdAdmissionId: ipdAdmissionId,
        },
        {
          icuAdmissionId: icuAdmissionId,
          ipdAdmissionId: ipdAdmissionId,
        },
      ];
    }else if (icuAdmissionId) {
      where.icuAdmissionId = icuAdmissionId;
    } else if (ipdAdmissionId) {
      where.ipdAdmissionId = ipdAdmissionId;
    }
    
    const vitals = await Vitals.findAll({
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
        ["recordedAtDate", "ASC"],
        ["recordedAtTime", "ASC"],
      ],
    });


    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    vitals.forEach((vital) => {
      if (!vital.recordedBy) return;

      if (vital.recordedByRole === "doctor") {
        doctorIds.push(vital.recordedBy);
      } else if (vital.recordedByRole === "subDoctor") {
        subDoctorIds.push(vital.recordedBy);
      } else {
        receptionistIds.push(vital.recordedBy);
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

    const formattedVitals = vitals.map((vital) => {
      const vitalData = vital.toJSON();

      let recordedByDetails = null;

      if (vital.recordedByRole === "doctor") {
        recordedByDetails =
          doctorMap.get(Number(vital.recordedBy)) || null;
      } else if (vital.recordedByRole === "subDoctor") {
        recordedByDetails =
          subDoctorMap.get(vital.recordedBy) || null;
      } else {
        recordedByDetails =
          receptionistMap.get(vital.recordedBy) || null;
      }

      let patient = null;

      if (vital.patient) {
        const patientData = vital.patient.toJSON();

        patient = {
          id: patientData.id,
          patientId: patientData.patientId,
          name: decryptSafe(patientData.name),
        };
      }

      let icuAdmission = null;

      if (vital.icuAdmission) {
        const icuData = vital.icuAdmission.toJSON();

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

      if (vital.ipdAdmission) {
        const ipdData = vital.ipdAdmission.toJSON();

        ipdAdmission = {
          id: ipdData.id,
          admissionNumber: ipdData.admissionNumber,
          patientId: ipdData.patientId,
          admissionDate: ipdData.admissionDate,
          status: ipdData.status,
        };
      }

      return {
        ...vitalData,
        recordedByDetails,
        patient,
        icuAdmission,
        ipdAdmission,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Vitals fetched successfully",
      vitals: formattedVitals,

    });
  } catch (error) {
    console.error("Get vitals by patient error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch vitals",
    });
  }
};

exports.deleteVitals = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { vitalId } = req.params;

    if (!vitalId) {
      return res.status(400).json({
        success: false,
        message: "Vital Id is required",
      });
    }

    const vital = await Vitals.findOne({
      where: {
        id: vitalId,
        hospitalId,
      },
    });

    if (!vital) {
      return res.status(404).json({
        success: false,
        message: "Vitals record not found",
      });
    }

    await vital.destroy();

    return res.status(200).json({
      success: true,
      message: "Vitals deleted successfully",
    });
  } catch (error) {
    console.error("Delete vitals error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete vitals",
    });
  }
};

exports.getLatestVitals = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { searchTerm } = req.query;

    const { recordedAtDate } = req.query;

    const vitals = await Vitals.findAll({
      where: {
        hospitalId,
        ...(recordedAtDate ? { recordedAtDate } : {}),
        icuAdmissionId: {
          [Op.ne]: null,
        },
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

    let filteredData = vitals.map((item) => {
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

    const latestVitalsMap = new Map();

    filteredData.forEach((data) => {
      const key = `${data.patientId}_${data.icuAdmissionId}`;

      if (!latestVitalsMap.has(key)) {
        latestVitalsMap.set(key, data);
      }
    });

    const latestvitals = Array.from(
      latestVitalsMap.values()
    );

    return res.status(200).json({
      success: true,
      message: "ICU vitals fetched successfully",
      data: latestvitals,
    });
  } catch (error) {
    console.error("Get Latest ICU vitals Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ICU vitals",
    });
  }
};