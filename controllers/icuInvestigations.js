const { Op } = require("sequelize");

const { Investigation, ICUAdmission, Patient, Receptionist, Doctor, SubDoctor} = require("../models");
const { decrypt, getDecryptedDocumentAsBase64 } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

exports.addInvestigation = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      patientId,
      icuAdmissionId,
      investigationName,
      result,
      investigationDate,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required.",
      });
    }

    if (!icuAdmissionId) {
      return res.status(400).json({
        success: false,
        message: "ICU admission ID is required.",
      });
    }

    if (!investigationName || !investigationName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Investigation name is required.",
      });
    }

    const createdBy =
      ["doctor", "subDoctor"].includes(req.user.role) 
        ? req.user.id
        : req.user.receptionistId;
        
    const createdByRole = req.user.role;

    if (!createdBy || !createdByRole) {
      return res.status(401).json({
        success: false,
        message: "User information not found.",
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

    const icuAdmission = await ICUAdmission.findOne({
      where: {
        id: icuAdmissionId,
        patientId,
        hospitalId,
      },
    });


    if (!icuAdmission) {
      return res.status(404).json({
        success: false,
        message: "ICU admission not found for this patient.",
      });
    }

    const documentFile = req.file;
    const document = documentFile?.buffer
      ? `data:${documentFile.mimetype};base64,${documentFile.buffer.toString("base64")}`
      : null;
    const documentMimeType = documentFile?.mimetype || null;

    await Investigation.create({
      hospitalId,
      patientId: patient.id,
      patientUniqueId: patient.patientId,
      icuAdmissionId,
      investigationName: investigationName.trim(),
      result: result || null,
      document,
      documentMimeType,
      investigationDate: investigationDate ?? new Date(),
      createdBy,
      createdByRole,
    });

    return res.status(201).json({
      success: true,
      message: "Investigation added successfully.",
    });
  } catch (error) {
    console.error("Add Investigation Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add investigation.",
    });
  }
};

exports.getInvestigationData = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      date,
      icuAdmissionId,
      patientId,
      searchTerm,
    } = req.query;

    console.log("seachterm",searchTerm);

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

    const where = {
      hospitalId,
    };

    const filterDate = date || null;

    if (filterDate) {

        const [year, month, day] = filterDate.split("-").map(Number);

        const nextDay = new Date(year, month - 1, day + 1);

        const nextDateString = `${nextDay.getFullYear()}-${String(
            nextDay.getMonth() + 1
        ).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;

        where.investigationDate = {
            [Op.gte]: `${filterDate} 00:00:00`,
            [Op.lt]: `${nextDateString} 00:00:00`,
        };
    }

    if (patientId) {
      where.patientId = patientId;
    }

    if (icuAdmissionId) {
      where.icuAdmissionId = icuAdmissionId;
    }

    const investigations = await Investigation.findAll({
      where,
      include:[
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "patientId","name","mobileNumber","gender","age","email"],
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
        ["createdAt", "ASC"],
      ],
    });

    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    investigations.forEach((data) => {
      if (!data.createdBy) return;

      if (data.createdByRole === "doctor") {
        doctorIds.push(data.createdBy);
      } else if (data.createdByRole === "subDoctor") {
        subDoctorIds.push(data.createdBy);
      } else {
        receptionistIds.push(data.createdBy);
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
    : [];

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
          name: decrypt(doctor.name),
          email: doctor.email,
        },
      ])
    );

    const subDoctorMap = new Map(
      subDoctors.map((subDoctor) => [
        subDoctor.id,
        {
          id: subDoctor.id,
          name: decrypt(subDoctor.name),
          email: subDoctor.email,
        },
      ])
    );

    const receptionistMap = new Map(
      receptionists.map((receptionist) => [
        receptionist.receptionistId,
        {
          id: receptionist.id,
          name: decrypt(receptionist.name),
          email: receptionist.email,
          receptionistId: receptionist.receptionistId,
        },
      ])
    );

    let formattedInvestigations = investigations.map((data) => {
      const investigationData = data.toJSON();

      let recordedByDetails = null;

      if (data.createdByRole === "doctor") {
        recordedByDetails =
           doctorMap.get(Number(data.createdBy)) || null;
      } else if (data.createdByRole === "subDoctor") {
        recordedByDetails =
          subDoctorMap.get(data.createdBy) || null;
      } else {
        recordedByDetails =
          receptionistMap.get(data.createdBy) || null;
      }

      if (investigationData.document) {
        investigationData.document = getDecryptedDocumentAsBase64(investigationData.document);
      }

      let patient = null;

      if (data.patient) {
        const patientData = data.patient.toJSON();
        patient = {
          id: patientData.id,
          patientId: patientData.patientId,
          name: decrypt(patientData.name),
          mobileNumber: decrypt(patientData.mobileNumber),
          gender:patientData.gender,
          age:patientData.age,
          email: decrypt(patientData.email),
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

    
      return {
        ...investigationData,
        recordedByDetails,
        patient,
        icuAdmission,
      };
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      formattedInvestigations = formattedInvestigations.filter((item) => {
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

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: formattedInvestigations,
    });
  } catch (error) {
    console.error("Get investigations error:", error);

    return res.status(500).json({
      success: false,
     message: error.message || "Failed to fetch investigations records",
    });
  }
};
