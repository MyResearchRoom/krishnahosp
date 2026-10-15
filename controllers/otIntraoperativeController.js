"use strict";

const {
  OTBooking,
  OTIntraoperativeNote,
  sequelize,
} = require("../models");

const getHospitalId = (req) => req.user?.hospitalId;

const TEXT_FIELDS = [
  "postOpDiagnosis",
  "patientPosition",
  "operativeFindings",
  "procedureDescription",
  "specimenDetails",
  "drainType",
  "complicationDetails",
  "instrumentSwabCounts",
  "endOfProcedureCondition",
];

exports.addOTIntraoperativeNote = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const otBookingId = Number(req.params.bookingId);
  const body = req.body;

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(otBookingId) || otBookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      message: "Provide intraoperative note details in the request body.",
    });
  }

  for (const field of TEXT_FIELDS) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: `${field} must be a string.`,
      });
    }
  }

  const timestamps = {};
  for (const field of ["startTime", "endTime"]) {
    if (body[field] !== undefined && body[field] !== null) {
      if (
        typeof body[field] !== "string" ||
        Number.isNaN(Date.parse(body[field]))
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid date-time string.`,
        });
      }
      timestamps[field] = new Date(body[field]);
    } else {
      timestamps[field] = null;
    }
  }

  if (
    timestamps.startTime &&
    timestamps.endTime &&
    timestamps.endTime < timestamps.startTime
  ) {
    return res.status(400).json({
      success: false,
      message: "endTime cannot be before startTime.",
    });
  }

  let estimatedBloodLossMl = null;
  if (body.estimatedBloodLossMl !== undefined && body.estimatedBloodLossMl !== null) {
    if (
      typeof body.estimatedBloodLossMl !== "number" ||
      !Number.isFinite(body.estimatedBloodLossMl) ||
      body.estimatedBloodLossMl < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "estimatedBloodLossMl must be a non-negative number.",
      });
    }
    estimatedBloodLossMl = body.estimatedBloodLossMl;
  }

  for (const field of ["specimenSent", "drainPlaced", "complications"]) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") {
      return res.status(400).json({
        success: false,
        message: `${field} must be a boolean.`,
      });
    }
  }

  const createdById = ["doctor", "subDoctor"].includes(req.user?.role)
    ? req.user.id
    : req.user?.receptionistId;

  if (!createdById || !req.user?.role) {
    return res.status(401).json({
      success: false,
      message: "Unable to identify the user creating the intraoperative note.",
    });
  }

  try {
    const note = await sequelize.transaction(async (transaction) => {
      const booking = await OTBooking.findOne({
        where: {
          id: otBookingId,
          hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!booking) {
        const error = new Error("OT booking not found.");
        error.status = 404;
        throw error;
      }

      if (booking.status!=="in_progress") {
        const error = new Error(
          `Intraoperative notes can only be added to OT bookings with status "in_progress". Current status is "${booking.status}".`
        );
        error.status = 409;
        throw error;
      }

      const noteData = {
        hospitalId,
        otBookingId,
        createdById: String(createdById),
        createdByRole: req.user.role,
        startTime: timestamps.startTime,
        endTime: timestamps.endTime,
        estimatedBloodLossMl,
      };

      for (const field of TEXT_FIELDS) {
        if (body[field] !== undefined) {
          noteData[field] = body[field]?.trim() || null;
        }
      }

      for (const field of ["specimenSent", "drainPlaced", "complications"]) {
        if (body[field] !== undefined) {
          noteData[field] = body[field];
        }
      }

      return OTIntraoperativeNote.create(noteData, { transaction });
    });

    return res.status(201).json({
      success: true,
      message: "OT intraoperative note added successfully.",
      data: note,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Add OT intraoperative note error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add OT intraoperative note.",
    });
  }
};

exports.getOTIntraoperativeNotesByBookingId = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const otBookingId = Number(req.params.bookingId);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(otBookingId) || otBookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  try {
    const booking = await OTBooking.findOne({
      where: {
        id: otBookingId,
        hospitalId,
      },
      attributes: ["id"],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "OT booking not found.",
      });
    }

    const notes = await OTIntraoperativeNote.findAll({
      where: {
        hospitalId,
        otBookingId,
      },
      order: [["createdAt", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "OT intraoperative notes fetched successfully.",
      data: notes,
    });
  } catch (error) {
    console.error("Get OT intraoperative notes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch OT intraoperative notes.",
    });
  }
};

exports.deleteOTIntraoperativeNoteById = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const noteId = Number(req.params.noteId);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid intraoperative note ID is required.",
    });
  }

  try {
    const deletedCount = await OTIntraoperativeNote.destroy({
      where: {
        id: noteId,
        hospitalId,
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "OT intraoperative note not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OT intraoperative note deleted successfully.",
    });
  } catch (error) {
    console.error("Delete OT intraoperative note error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete OT intraoperative note.",
    });
  }
};
