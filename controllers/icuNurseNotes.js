const { Op } = require("sequelize");

const { ICUAdmission, Patient,Receptionist,ICUNursingNote,sequelize } = require("../models");
const { decrypt } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

exports.addICUNursingNote = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Hospital ID is required",
      });
    }

    const {
      icuAdmissionId,
      patientId,
      noteDate,
      noteTime,
      patientCondition,
      observations,
      nursingIntervention,
      patientResponse,
      additionalNotes,
    } = req.body;


    if (
      !icuAdmissionId ||
      !patientId ||
      !noteDate ||
      !noteTime
    ) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message:
          "ICU admission, patient, note date and note time are required",
      });
    }

    const nurseId = req.user?.id;

    if (!nurseId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Unable to identify nurse",
      });
    }

    const nurse = await Receptionist.findOne({
      where: {
        id: nurseId,
        doctorId:hospitalId,
        role: "nurse",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!nurse) {
      await transaction.rollback();

      return res.status(403).json({
        success: false,
        message: "Only an authorized nurse can add ICU nursing notes",
      });
    }

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        doctorId: hospitalId,
      },
      transaction,
    });

    if (!patient) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const icuAdmission = await ICUAdmission.findOne({
      where: {
        id: icuAdmissionId,
        hospitalId,
        patientId,
      },
      transaction,
    });

    if (!icuAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "ICU admission not found for this patient",
      });
    }

    if (
      ["DISCHARGED", "CANCELLED","TRANSFERRED"].includes(
        String(icuAdmission.status).toUpperCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `ICU admission is already ${icuAdmission.status}, so notes cannot be added`,
      });
    }

    await ICUNursingNote.create(
      {
        hospitalId,

        icuAdmissionId: icuAdmission.id,

        patientId: patient.id,

        patientUniqueId: patient.patientId,

        noteDate,
        noteTime,

        nurseId: nurse.id,

        patientCondition:
          patientCondition ?? null,

        observations:
          observations ?? null,

        nursingIntervention:
          nursingIntervention ?? null,

        patientResponse:
          patientResponse ?? null,

        additionalNotes:
          additionalNotes ?? null,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "ICU nursing note added successfully",
    });
  } catch (error) {
    await transaction.rollback();

    console.error(
      "Add ICU nursing note error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add ICU nursing note",
    });
  }
};

exports.getLatestICUNursingNote = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { searchTerm,noteDate } = req.query;
    console.log("seachterm",searchTerm);
    

    const where = {
      hospitalId,
    };

    if (noteDate) {
      where.noteDate = noteDate;
    }

    const nusrsingNotes = await ICUNursingNote.findAll({
      where,
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
          ],
        },
        {
          model: ICUAdmission,
          as: "icuAdmission",
          attributes: [
            "id",
            "icuAdmissionNumber",
            "admissionDate",
            "admissionTime",
            "status",
          ],
        },
        {
          model: Receptionist,
          as: "nurse",
          attributes: [
            "id",
            "name",
            "receptionistId",
          ],
          required: false,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    let filteredData = nusrsingNotes.map((item) => {
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

      if (data.nurse) {
        data.nurse.name = data.nurse.name
          ? decrypt(data.nurse.name)
          : "";
      }

      return data;
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      filteredData = filteredData.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;
        const nurse = item.nurse;

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
            .includes(keyword) ||

          nurse?.name
            ?.toLowerCase()
            .includes(keyword) ||

          nurse?.receptionistId
            ?.toLowerCase()
            .includes(keyword)
            
        );
      });
    }

    const latestNursingNotesMap = new Map();

    filteredData.forEach((data) => {
      const key = `${data.patientId}_${data.icuAdmissionId}`;

      if (!latestNursingNotesMap.has(key)) {
        latestNursingNotesMap.set(key, data);
      }
    });

    const latestNotes = Array.from(
      latestNursingNotesMap.values()
    );

    return res.status(200).json({
      success: true,
      message: "ICU Nursing Notes fetched successfully",
      data: latestNotes,
    });
  } catch (error) {
    console.error("Get Latest ICU nursing note Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ICU nursing notes",
    });
  }
};

exports.getICUNursingNotes = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital ID is required",
      });
    }

    const {
      patientId,
      icuAdmissionId,
      searchTerm,
      noteDate,
    } = req.query;

    const where = {
      hospitalId,
    };

    if (patientId) {
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

    if (patientId) {
      where.patientId = patientId;
    }

    if (icuAdmissionId) {
      where.icuAdmissionId = icuAdmissionId;
    }

    if (noteDate) {
      where.noteDate = noteDate;
    }

    const notes = await ICUNursingNote.findAll({
      where,

      include: [
        {
          model: Patient,
          as: "patient",
          attributes: [
            "id",
            "patientId",
            "name",
            "email",
          ],
          required: false,
        },

        {
          model: ICUAdmission,
          as: "icuAdmission",
          attributes: [
            "id",
            "icuAdmissionNumber",
            "admissionDate",
            "admissionTime",
            "status",
          ],
          required: false,
        },

        {
          model: Receptionist,
          as: "nurse",
          attributes: [
            "id",
            "name",
            "receptionistId",
          ],
          required: false,
        },
      ],

      order: [
        ["createdAt", "DESC"],
      ],
    });

    
    let filteredData = notes.map((item) => {
      const data = item.toJSON();

      if (data.patient) {
        data.patient.name = data.patient.name
          ? decrypt(data.patient.name)
          : "";

        data.patient.email = data.patient.email
          ? decrypt(data.patient.email)
          : "";
      }

      if (data.nurse) {
        data.nurse.name = data.nurse.name
          ? decrypt(data.nurse.name)
          : "";
      }

      return data;
    });

    if (searchTerm) {
      const keyword = searchTerm.trim().toLowerCase();

      filteredData = filteredData.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;
        const nurse = item.nurse;

        return (
          patient?.name
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.patientId
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.email
            ?.toLowerCase()
            .includes(keyword) ||

          admission?.icuAdmissionNumber
            ?.toLowerCase()
            .includes(keyword) ||

          nurse?.name
            ?.toLowerCase()
            .includes(keyword) ||

          nurse?.receptionistId
            ?.toLowerCase()
            .includes(keyword)
            
        );
      });
    }

    return res.status(200).json({
      success: true,
      message: "ICU nursing notes fetched successfully",
      data: filteredData,
    });
  } catch (error) {
    console.error(
      "Get ICU nursing notes error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ICU nursing notes",
      error: error.message,
    });
  }
};