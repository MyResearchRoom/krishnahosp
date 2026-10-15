const { Op } = require("sequelize");

const { ICUDoctorNote, ICUAdmission, Patient, Doctor,SubDoctor, } = require("../models");
const { decrypt } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

exports.addICUDoctorNote = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      icuAdmissionId,
      patientId,
      noteDate,
      noteTime,
      chiefComplaint,
      clinicalFindings,
      advice,
      diagnosis,
      treatmentPlan,
      notes,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    if (!icuAdmissionId) {
      return res.status(400).json({
        success: false,
        message: "ICU admission ID is required",
      });
    }

    if (!req.user?.role) {
      return res.status(401).json({
        success: false,
        message: "User role not found",
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
        hospitalId,
        patientId,
      },
    });

    if (!icuAdmission) {
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

    let doctorId = null;
    let subDoctorId = null;

    if (req.user.role === "doctor") {
      doctorId = req.user.id;
    }

    if (req.user.role === "subDoctor") {
      subDoctorId = String(req.user.id);
    }

    const icuDoctorNote = await ICUDoctorNote.create({
      hospitalId,
      icuAdmissionId,
      patientId,

      doctorId,
      subDoctorId,

      createdByRole: req.user.role,

      noteDate: noteDate || new Date().toISOString().split("T")[0],
      noteTime: noteTime || new Date().toTimeString().split(" ")[0],
      
      chiefComplaint: chiefComplaint || null,
      clinicalFindings: clinicalFindings || null,
      advice: advice || null,
      diagnosis: diagnosis || null,
      treatmentPlan: treatmentPlan || null,
      notes: notes || null,
    });

    return res.status(201).json({
      success: true,
      message: "ICU doctor note added successfully",
      data: icuDoctorNote,
    });
  } catch (error) {
    console.error("Add ICU Doctor Note Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add ICU doctor note",
      error: error.message,
    });
  }
};

exports.getLatestICUDoctorNote = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const { searchTerm,noteDate } = req.query;

    const where = {
      hospitalId,
    };

    if (noteDate) {
      where.noteDate = noteDate;
    }

    const doctorNotes = await ICUDoctorNote.findAll({
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
          model: Doctor,
          as: "doctor",
          attributes: [
            "id",
            "name",
            "email",
            "doctorId"
          ],
        },

        {
          model: SubDoctor,
          as: "subDoctor",
          attributes: [
            "id",
            "name",
            "email",
          ],
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    let filteredData = doctorNotes.map((item) => {
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

      if (data.doctor) {
        data.doctor.name = data.doctor.name
          ? decrypt(data.doctor.name)
          : "";
      }

      if (data.subDoctor) {
        data.subDoctor.name = data.subDoctor.name
          ? decrypt(data.subDoctor.name)
          : "";
      }

      return data;
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      filteredData = filteredData.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;
        const doctor = item.doctor;
        const subDoctor = item.subDoctor;

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

          doctor?.name
            ?.toLowerCase()
            .includes(keyword) ||

          doctor?.doctorId
            ?.toLowerCase()
            .includes(keyword) ||

          subDoctor?.name
            ?.toLowerCase()
            .includes(keyword) ||

          subDoctor?.id
            ?.toLowerCase()
            .includes(keyword)
            
        );
      });
    }

    const latestDcotorNoteMap = new Map();

    filteredData.forEach((data) => {
      const key = `${data.patientId}_${data.icuAdmissionId}`;

      if (!latestDcotorNoteMap.has(key)) {
        latestDcotorNoteMap.set(key, data);
      }
    });

    const latestDoctorNotes = Array.from(
      latestDcotorNoteMap.values()
    );

    return res.status(200).json({
      success: true,
      message: "ICU Doctor Notes fetched successfully",
      data: latestDoctorNotes,
    });
  } catch (error) {
    console.error("Get Latest ICU doctor note Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ICU doctor notes",
    });
  }
};

exports.getICUDoctorNotes = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital ID is required",
      });
    }

    const {
      icuAdmissionId,
      patientId,
      noteDate,
    } = req.query;

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

    const where = {
      hospitalId,
    };

    if (icuAdmissionId) {
      where.icuAdmissionId = icuAdmissionId;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    if (noteDate) {
      where.noteDate = noteDate;
    }

    const notes = await ICUDoctorNote.findAll({
      where,
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "patientId", "name","email"],
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
          model: Doctor,
          as: "doctor",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: SubDoctor,
          as: "subDoctor",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [
        ["noteDate", "DESC"],
        ["id", "DESC"],
      ],
    });

    // let filteredData = notes.map((item) => {
    //   const data = item.toJSON();

    //   if (data.patient) {
    //     data.patient.name = data.patient.name
    //       ? decrypt(data.patient.name)
    //       : "";

    //     data.patient.email = data.patient.email
    //       ? decrypt(data.patient.email)
    //       : "";
    //   }

    //   if (data.nurse) {
    //     data.nurse.name = data.nurse.name
    //       ? decrypt(data.nurse.name)
    //       : "";
    //   }

    //   return data;
    // });

    const formattedNotes = notes.map((note) => {
      const data = note.toJSON();

      return {
        ...data,

        patient: data.patient
          ? {
              ...data.patient,
              name: decrypt(data.patient.name),
            }
          : null,

        doctor : 
        data.doctor
          ? {
              ...data.doctor,
              name: decrypt(data.doctor.name),
            }
          : data.subDoctor
          ? {
              ...data.subDoctor,
              name: decrypt(data.subDoctor.name),
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "ICU doctor notes fetched successfully",
      data: formattedNotes,
    });
  } catch (error) {
    console.error("Get ICU Doctor Notes Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ICU doctor notes",
      error: error.message,
    });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { noteId } = req.params;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: "Note Id is required",
      });
    }

    const note = await ICUDoctorNote.findOne({
      where: {
        id: noteId,
        hospitalId,
      },
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note record not found",
      });
    }

    await note.destroy();

    return res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Delete note error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete note",
    });
  }
};