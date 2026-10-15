const { Op } = require("sequelize");

const { ICUProcedure, ICUAdmission, Patient, Receptionist, Doctor, SubDoctor} = require("../models");
const { decrypt, getDecryptedDocumentAsBase64 } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

exports.addProcedure = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      patientId,
      icuAdmissionId,
      procedureName,
      procedureDate,
      procedureTime,
      preProcedureNotes,
      indication,
      details,
      complications,
      postProcedureCondition,
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

    if (!procedureName || !procedureName.trim() || !procedureDate || !procedureTime) {
      return res.status(400).json({
        success: false,
        message: "Provide all required data is required.",
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

    await ICUProcedure.create({
      hospitalId,
      patientId: patient.id,
      patientUniqueId: patient.patientId,
      icuAdmissionId,
      procedureName,
      procedureDate,
      procedureTime,
      preProcedureNotes: preProcedureNotes ||null,
      indication :indication || null,
      details: details || null,
      complications:
        complications !== undefined && complications !== null
        ? Number(complications)
        : 0,
      postProcedureCondition : postProcedureCondition || null,
      createdBy,
      createdByRole,
    });

    return res.status(201).json({
      success: true,
      message: "Procedure added successfully.",
    });
  } catch (error) {
    console.error("Add Procedure Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add procedure.",
    });
  }
};

exports.getProcedureData = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      date,
      icuAdmissionId,
      patientId,
      searchTerm,
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
      where.procedureDate = filterDate;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    if (icuAdmissionId) {
      where.icuAdmissionId = icuAdmissionId;
    }

    const procedures = await ICUProcedure.findAll({
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
        ["createdAt", "DESC"],
      ],
    });

    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    procedures.forEach((data) => {
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

    let formattedProcedure = procedures.map((data) => {
      const procedureData = data.toJSON();

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
        ...procedureData,
        recordedByDetails,
        patient,
        icuAdmission,
      };
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      formattedProcedure = formattedProcedure.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;

        return (
          item?.procedureName
            ?.toLowerCase()
            .includes(keyword) ||


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
      data: formattedProcedure,
    });
  } catch (error) {
    console.error("Get procedures error:", error);

    return res.status(500).json({
      success: false,
     message: error.message || "Failed to fetch procedures records",
    });
  }
};

exports.getProcedureDataById = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { procedureId } = req.params;

    if (!procedureId) {
      return res.status(400).json({
        success: false,
        message: "Procedure Id is required",
      });
    }

    const procedure = await ICUProcedure.findOne({
      where: {
        id: procedureId,
        hospitalId,
      },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: [
            "id",
            "patientId",
            "name",
            "mobileNumber",
            "gender",
            "age",
            "email",
          ],
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
    });

    if (!procedure) {
      return res.status(404).json({
        success: false,
        message: "Procedure not found",
      });
    }

    const procedureData = procedure.toJSON();

    let recordedByDetails = null;

    if (procedure.createdByRole === "doctor") {
      const doctor = await Doctor.findOne({
        where: {
          id: Number(procedure.createdBy),
        },
        attributes: ["id", "name", "email"],
      });

      if (doctor) {
        recordedByDetails = {
          id: doctor.id,
          name: decrypt(doctor.name),
          email: doctor.email,
        };
      }
    } else if (procedure.createdByRole === "subDoctor") {
      const subDoctor = await SubDoctor.findOne({
        where: {
          id: procedure.createdBy,
        },
        attributes: ["id", "name", "email"],
      });

      if (subDoctor) {
        recordedByDetails = {
          id: subDoctor.id,
          name: decrypt(subDoctor.name),
          email: subDoctor.email,
        };
      }
    } else if (procedure.createdByRole === "receptionist") {
      const receptionist = await Receptionist.findOne({
        where: {
          receptionistId: procedure.createdBy,
        },
        attributes: [
          "id",
          "name",
          "email",
          "receptionistId",
        ],
      });

      if (receptionist) {
        recordedByDetails = {
          id: receptionist.id,
          name: decrypt(receptionist.name),
          email: receptionist.email,
          receptionistId: receptionist.receptionistId,
        };
      }
    }

    let patient = null;

    if (procedure.patient) {
      const patientData = procedure.patient.toJSON();

      patient = {
        id: patientData.id,
        patientId: patientData.patientId,
        name: decrypt(patientData.name),
        mobileNumber: decrypt(patientData.mobileNumber),
        gender: patientData.gender,
        age: patientData.age,
        email: decrypt(patientData.email),
      };
    }


    let icuAdmission = null;

    if (procedure.icuAdmission) {
      const icuData = procedure.icuAdmission.toJSON();

      icuAdmission = {
        id: icuData.id,
        icuAdmissionNumber: icuData.icuAdmissionNumber,
        patientId: icuData.patientId,
        admissionDate: icuData.admissionDate,
        admissionTime: icuData.admissionTime,
        status: icuData.status,
      };
    }


    const formattedProcedure = {
      ...procedureData,
      recordedByDetails,
      patient,
      icuAdmission,
    };

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: formattedProcedure,
    });
  } catch (error) {
    console.error("Get procedure error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to fetch procedure record by id",
    });
  }
};