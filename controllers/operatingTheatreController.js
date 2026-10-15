
"use strict";

const { Op } = require("sequelize");
const {
  Doctor,
  ICUAdmission,
  IPDAdmission,
  OperatingTheatre,
  OTBooking,
  Patient,
  SubDoctor,
  sequelize,
} = require("../models");

const getHospitalId = (req) => req.user?.hospitalId;
const THEATRE_STATUSES = ["available", "occupied", "maintenance", "inActive"];
const OT_PRIORITIES = ["routine", "urgent", "emergency"];

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeTime = (value) => {
  if (typeof value !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return null;
  }

  const [hours, minutes, seconds = "00"] = value.split(":");
  if (
    Number(hours) > 23 ||
    Number(minutes) > 59 ||
    Number(seconds) > 59
  ) {
    return null;
  }

  return `${hours}:${minutes}:${seconds}`;
};

const isValidDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const generateTheatreCode = async (hospitalId, transaction) => {
  const theatres = await OperatingTheatre.findAll({
    where: { hospitalId },
    attributes: ["theatreCode"],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const highestCode = theatres.reduce((highest, theatre) => {
    const match = /^OT-(\d+)$/.exec(theatre.theatreCode);

    return match
      ? Math.max(highest, Number(match[1]))
      : highest;
  }, 0);

  return `OT-${String(highestCode + 1).padStart(4, "0")}`;
};

exports.createOperatingTheatre = async (req, res) => {
  const hospitalId = getHospitalId(req);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  const { theatreName, location, specialty } = req.body;

  if (
    typeof theatreName !== "string" ||
    !theatreName.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Theatre name is required.",
    });
  }

  if (theatreName.trim().length > 150) {
    return res.status(400).json({
      success: false,
      message: "Theatre name must not exceed 150 characters.",
    });
  }

  if (
    typeof specialty !== "string" ||
    !specialty.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Specialty is required.",
    });
  }

  if (specialty.trim().length > 150) {
    return res.status(400).json({
      success: false,
      message: "Specialty must not exceed 100 characters.",
    });
  }

  let transaction;

  try {
    transaction = await sequelize.transaction();

    const theatreCode = await generateTheatreCode(
      hospitalId,
      transaction
    );

    await OperatingTheatre.create(
      {
        hospitalId,
        theatreCode,
        theatreName: theatreName.trim(),
        location:
          typeof location === "string" && location.trim()
            ? location.trim()
            : null,
        specialty:specialty.trim(),
        status: "available",
        isBlock: false,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Operating theatre added successfully.",
      theatreCode,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Create operating theatre error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add operating theatre.",
    });
  }
};

exports.requestOTBooking = async (req, res) => {
  const hospitalId = getHospitalId(req);
  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  const {
    patientId,
    ipdAdmissionId,
    icuAdmissionId,
    theatreId,
    procedureName,
    specialty,
    scheduleDate,
    scheduledStartTime,
    scheduledEndTime,
    doctorId,
    subDoctorId,
    priority = "routine",
    notes,
  } = req.body;

  const parsedPatientId = Number(patientId);
  if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid patientId is required.",
    });
  }

  if (typeof procedureName !== "string" || !procedureName.trim() || procedureName.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: "Procedure name is required and must not exceed 200 characters.",
    });
  }

  if (typeof specialty !== "string" || !specialty.trim() || specialty.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: "Specialty is required and must not exceed 100 characters.",
    });
  }

  if (!isValidDateOnly(scheduleDate)) {
    return res.status(400).json({
      success: false,
      message: "scheduleDate must be a valid date in YYYY-MM-DD format.",
    });
  }

  if ((scheduledStartTime && !scheduledEndTime) || (!scheduledStartTime && scheduledEndTime)) {
    return res.status(400).json({
      success: false,
      message: "Provide both scheduledStartTime and scheduledEndTime, or neither.",
    });
  }

  const normalizedStartTime = scheduledStartTime
    ? normalizeTime(scheduledStartTime)
    : null;
  const normalizedEndTime = scheduledEndTime
    ? normalizeTime(scheduledEndTime)
    : null;

  if (
    (scheduledStartTime && !normalizedStartTime) ||
    (scheduledEndTime && !normalizedEndTime)
  ) {
    return res.status(400).json({
      success: false,
      message: "Scheduled times must use valid HH:mm or HH:mm:ss values.",
    });
  }

  if (normalizedStartTime && normalizedEndTime && normalizedEndTime <= normalizedStartTime) {
    return res.status(400).json({
      success: false,
      message: "scheduledEndTime must be after scheduledStartTime on the same date.",
    });
  }

  if (!OT_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: `Priority must be one of: ${OT_PRIORITIES.join(", ")}.`,
    });
  }

  if (doctorId != null && subDoctorId != null) {
    return res.status(400).json({
      success: false,
      message: "Provide either doctorId or subDoctorId, not both.",
    });
  }

  if (notes != null && (typeof notes !== "string" || notes.length > 10000)) {
    return res.status(400).json({
      success: false,
      message: "Notes must be text with a maximum length of 10000 characters.",
    });
  }

  try {
    const booking = await sequelize.transaction(async (transaction) => {
      const patient = await Patient.findOne({
        where: {
          id: parsedPatientId,
          doctorId: hospitalId,
        },
        transaction,
      });

      if (!patient) {
        throw createHttpError(404, "Patient not found.");
      }

      let parsedIpdAdmissionId = null;
      if (ipdAdmissionId != null && ipdAdmissionId !== "") {
        parsedIpdAdmissionId = Number(ipdAdmissionId);
        if (!Number.isInteger(parsedIpdAdmissionId) || parsedIpdAdmissionId <= 0) {
          throw createHttpError(400, "A valid ipdAdmissionId is required.");
        }

        const admission = await IPDAdmission.findOne({
          where: {
            id: parsedIpdAdmissionId,
            patientId: parsedPatientId,
            hospitalId,
          },
          transaction,
        });
        if (!admission) {
          throw createHttpError(400, "IPD admission does not match this patient and hospital.");
        }
      }

      let parsedIcuAdmissionId = null;
      if (icuAdmissionId != null && icuAdmissionId !== "") {
        parsedIcuAdmissionId = Number(icuAdmissionId);
        if (!Number.isInteger(parsedIcuAdmissionId) || parsedIcuAdmissionId <= 0) {
          throw createHttpError(400, "A valid icuAdmissionId is required.");
        }

        const admissionWhere = {
          id: parsedIcuAdmissionId,
          patientId: parsedPatientId,
          hospitalId,
        };
        if (parsedIpdAdmissionId) {
          admissionWhere.ipdAdmissionId = parsedIpdAdmissionId;
        }

        const admission = await ICUAdmission.findOne({
          where: admissionWhere,
          transaction,
        });
        if (!admission) {
          throw createHttpError(400, "ICU admission does not match this patient, hospital, and IPD admission.");
        }
      }

      let parsedTheatreId = null;
      if (theatreId != null && theatreId !== "") {
        parsedTheatreId = Number(theatreId);
        if (!Number.isInteger(parsedTheatreId) || parsedTheatreId <= 0) {
          throw createHttpError(400, "A valid theatreId is required.");
        }

        const theatre = await OperatingTheatre.findOne({
          where: {
            id: parsedTheatreId,
            hospitalId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!theatre) {
          throw createHttpError(404, "Operating theatre not found.");
        }
        if (theatre.isBlock || ["maintenance", "inActive"].includes(theatre.status)) {
          throw createHttpError(400, "Selected operating theatre is blocked or unavailable.");
        }

        if (normalizedStartTime && normalizedEndTime) {
          const overlappingBooking = await OTBooking.findOne({
            where: {
              hospitalId,
              theatreId: parsedTheatreId,
              scheduleDate,
              status: {
                [Op.in]: ["requested", "scheduled", "in_progress"],
              },
              scheduledStartTime: {
                [Op.lt]: normalizedEndTime,
              },
              scheduledEndTime: {
                [Op.gt]: normalizedStartTime,
              },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (overlappingBooking) {
            throw createHttpError(409, "Operating theatre already has a booking during that time.");
          }
        }
      }

      let parsedDoctorId = null;
      if (doctorId != null && doctorId !== "") {
        parsedDoctorId = Number(doctorId);
        if (!Number.isInteger(parsedDoctorId) || parsedDoctorId <= 0) {
          throw createHttpError(400, "A valid doctorId is required.");
        }
        if (parsedDoctorId !== Number(hospitalId)) {
          throw createHttpError(400, "The selected doctor does not belong to this hospital.");
        }
        const doctor = await Doctor.findByPk(parsedDoctorId, { transaction });
        if (!doctor) {
          throw createHttpError(404, "Doctor not found.");
        }
      }

      let parsedSubDoctorId = null;
      if (subDoctorId != null && subDoctorId !== "") {
        if (typeof subDoctorId !== "string" || !subDoctorId.trim()) {
          throw createHttpError(400, "A valid subDoctorId is required.");
        }
        parsedSubDoctorId = subDoctorId.trim();
        const subDoctor = await SubDoctor.findOne({
          where: {
            id: parsedSubDoctorId,
            addedBy: hospitalId,
          },
          transaction,
        });
        if (!subDoctor) {
          throw createHttpError(404, "Sub-doctor not found.");
        }
      }

      return OTBooking.create(
        {
          hospitalId,
          patientId: parsedPatientId,
          ipdAdmissionId: parsedIpdAdmissionId,
          icuAdmissionId: parsedIcuAdmissionId,
          theatreId: parsedTheatreId,
          procedureName: procedureName.trim(),
          specialty: specialty.trim(),
          scheduleDate,
          scheduledStartTime: normalizedStartTime,
          scheduledEndTime: normalizedEndTime,
          doctorId: parsedDoctorId,
          subDoctorId: parsedSubDoctorId,
          priority,
          status: "requested",
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        },
        { transaction }
      );
    });

    return res.status(201).json({
      success: true,
      message: "OT request submitted successfully.",
      data: booking,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Request OT booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit OT request.",
    });
  }
};

exports.getOperatingTheatreById = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const theatreId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(theatreId) || theatreId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid operating theatre ID is required.",
    });
  }

  try {
    const theatre = await OperatingTheatre.findOne({
      where: {
        id: theatreId,
        hospitalId,
      },
    });

    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: "Operating theatre not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Operating theatre fetched successfully.",
      data: theatre,
    });
  } catch (error) {
    console.error("Get operating theatre by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch operating theatre.",
    });
  }
};

exports.updateOperatingTheatre = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const theatreId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(theatreId) || theatreId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid operating theatre ID is required.",
    });
  }

  const {
    theatreName,
    location,
    specialty,
  } = req.body;

  if (theatreName !== undefined) {
    if (
      typeof theatreName !== "string" ||
      !theatreName.trim() ||
      theatreName.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Theatre name must be a non-empty string up to 150 characters.",
      });
    }
  }

  if (location !== undefined && location !== null) {
    if (
      typeof location !== "string" ||
      location.trim().length > 255
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Location must be a string up to 255 characters.",
      });
    }
  }

  if (specialty !== undefined && specialty !== null) {
    if (
      typeof specialty !== "string" ||
      specialty.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Specialty must be a string up to 100 characters.",
      });
    }
  }

  try {
    const theatre = await OperatingTheatre.findOne({
      where: {
        id: theatreId,
        hospitalId,
      },
    });

    if (!theatre) {
      return res.status(404).json({
        success: false,
        message: "Operating theatre not found.",
      });
    }

    await theatre.update({
      theatreName:
        theatreName !== undefined
          ? theatreName.trim()
          : theatre.theatreName,

      location:
        location !== undefined
          ? (location === null || !location.trim()
              ? null
              : location.trim())
          : theatre.location,

      specialty:
        specialty !== undefined
          ? (specialty === null || !specialty.trim()
              ? null
              : specialty.trim())
          : theatre.specialty,

      status: theatre.status  ||"available",

      isBlock: theatre.isBlock || false,
    });

    return res.status(200).json({
      success: true,
      message: "Operating theatre updated successfully.",
      data: theatre,
    });
  } catch (error) {
    console.error("Update operating theatre error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update operating theatre.",
    });
  }
};

exports.toggleOperatingTheatreBlock = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const theatreId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(theatreId) || theatreId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid operating theatre ID is required.",
    });
  }

  try {
    const updatedTheatre = await sequelize.transaction(async (transaction) => {
      const theatre = await OperatingTheatre.findOne({
        where: {
          id: theatreId,
          hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!theatre) {
        return null;
      }

      const isBlock = !theatre.isBlock;
      await theatre.update(
        {
          isBlock,
          status: isBlock ? "inActive" : "available",
        },
        { transaction }
      );

      return theatre;
    });

    if (!updatedTheatre) {
      return res.status(404).json({
        success: false,
        message: "Operating theatre not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: updatedTheatre.isBlock
        ? "Operating theatre blocked successfully."
        : "Operating theatre unblocked successfully.",
      data: updatedTheatre,
    });
  } catch (error) {
    console.error("Toggle operating theatre block error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update operating theatre block status.",
    });
  }
};

exports.getOperatingTheatres = async (req, res) => {
  const hospitalId = getHospitalId(req);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  const { searchTerm, status, isBlock } = req.query;
  const where = { hospitalId };

  if (status !== undefined && status !== "all") {
    if (!THEATRE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${THEATRE_STATUSES.join(", ")}, all.`,
      });
    }
    where.status = status;
  }

  if (isBlock !== undefined && isBlock !== "all") {
    if (isBlock !== "true" && isBlock !== "false") {
      return res.status(400).json({
        success: false,
        message: "isBlock must be true, false, or all.",
      });
    }
    where.isBlock = isBlock === "true";
  }

  const trimmedSearch = typeof searchTerm === "string" ? searchTerm.trim() : "";
  if (trimmedSearch) {
    where[Op.or] = [
      { theatreCode: { [Op.like]: `%${trimmedSearch}%` } },
      { theatreName: { [Op.like]: `%${trimmedSearch}%` } },
      { location: { [Op.like]: `%${trimmedSearch}%` } },
      { specialty: { [Op.like]: `%${trimmedSearch}%` } },
    ];
  }

  try {
    const theatres = await OperatingTheatre.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Operating theatres fetched successfully.",
      data: theatres,
    });
  } catch (error) {
    console.error("Get operating theatres error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch operating theatres.",
    });
  }
};
