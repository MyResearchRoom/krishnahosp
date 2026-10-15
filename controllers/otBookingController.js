"use strict";
const { Op } = require("sequelize");

const {
  Doctor,
  ICUAdmission,
  IPDAdmission,
  OperatingTheatre,
  OTBooking,
  OTBookingTeam,
  OTPreoperativeChecklist,
  OTPreoperativeChecklistItem,
  Patient,
  SubDoctor,
  Receptionist,
  sequelize,
} = require("../models");

const getHospitalId = (req) => req.user?.hospitalId;

const { decrypt } = require("../utils/cryptography");

const THEATRE_STATUSES = ["available", "occupied", "maintenance", "inActive"];

const OT_PRIORITIES = ["routine", "urgent", "emergency"];

const OT_BOOKING_STATUSES = [
  "requested",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "postponed",
];
const ACTIVE_OT_BOOKING_STATUSES = ["requested", "scheduled", "in_progress"];

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const generateSurgeryNo = async (hospitalId, transaction) => {
  const hospital = await Doctor.findByPk(hospitalId, {
    attributes: ["id"],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!hospital) {
    throw createHttpError(404, "Hospital not found.");
  }

  const existingBookings = await OTBooking.findAll({
    where: { hospitalId },
    attributes: ["surgeryNo"],
    transaction,
  });

  const highestNumber = existingBookings.reduce((highest, booking) => {
    const match = /^SURG-(\d+)$/.exec(booking.surgeryNo || "");
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `SURG-${String(highestNumber + 1).padStart(4, "0")}`;
};

const isValidDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
    doctorId, 
    doctorType,
    ipdAdmissionId,
    icuAdmissionId,
    procedureName,
    specialty,
    scheduleDate,
    estimatedDurationMinutes,
    priority = "routine",
    notes,
    disgnosis,
    anaesthesia,
  } = req.body;

  const parsedPatientId = Number(patientId);
  if (!Number.isInteger(parsedPatientId) || parsedPatientId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid patientId is required.",
    });
  }

  if (!["doctor", "subDoctor"].includes(doctorType)) {
    return res.status(400).json({
      success: false,
      message: "doctorType must be doctor or subDoctor.",
    });
  }

  if (
    doctorId == null ||
    String(doctorId).trim() === ""
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid doctorId is required.",
    });
  }

  if (
    doctorType === "doctor" &&
    (!Number.isInteger(Number(doctorId)) || Number(doctorId) <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid doctor ID is required.",
    });
  }

  if (typeof procedureName !== "string" || !procedureName.trim() || procedureName.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: "Procedure name is required and must not exceed 200 characters.",
    });
  }

  if (typeof anaesthesia !== "string" || !anaesthesia.trim()) {
    return res.status(400).json({
      success: false,
      message: "Anaesthesia is required",
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

  const parsedEstimatedDurationMinutes = Number(estimatedDurationMinutes);
  if (
    !Number.isInteger(parsedEstimatedDurationMinutes) ||
    parsedEstimatedDurationMinutes <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "estimatedDurationMinutes must be a positive integer.",
    });
  }

  if (!OT_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: `Priority must be one of: ${OT_PRIORITIES.join(", ")}.`,
    });
  }

  if (notes != null && (typeof notes !== "string" || notes.length > 10000)) {
    return res.status(400).json({
      success: false,
      message: "Notes must be text with a maximum length of 10000 characters.",
    });
  }

  const requestedBy =
      ["doctor", "subDoctor"].includes(req.user.role) 
        ? req.user.id
        : req.user.receptionistId;
        
  const requestedByRole = req.user.role;

  if (!requestedBy || !requestedByRole) {
      return res.status(401).json({
        success: false,
        message: "Unable to identify who request ot surgary.",
      });
  }

  try {
    const booking = await sequelize.transaction(async (transaction) => {
      const surgeryNo = await generateSurgeryNo(hospitalId, transaction);
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

      const existingPatientBooking = await OTBooking.findOne({
        where: {
          hospitalId,
          patientId: parsedPatientId,
          scheduleDate,
          status: {
            [Op.in]: ACTIVE_OT_BOOKING_STATUSES,
          },
        },
        transaction,
      });

      if (existingPatientBooking) {
        throw createHttpError(
          409,
          "This patient already has an active OT booking on this date."
        );
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
          throw createHttpError(400, "IPD admission does not match this patient");
        }

        if (!["admitted", "transfer to ICU"].includes(admission.status)) {
          throw createHttpError(400, "No Active IPD admission found for this patient");
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

        if (!["ACTIVE", "TRANSFERRED_TO_IPD"].includes(admission.status)) {
          throw createHttpError(400, "No Active ICU admission found for this patient");
        }
      }

      return OTBooking.create(
        {
          hospitalId,
          patientId: parsedPatientId,
          surgeryNo,
          ipdAdmissionId: parsedIpdAdmissionId,
          icuAdmissionId: parsedIcuAdmissionId,
          procedureName: procedureName.trim(),
          specialty: specialty.trim(),
          scheduleDate,
          estimatedDurationMinutes: parsedEstimatedDurationMinutes,
          scheduledStartTime: null,
          scheduledEndTime: null,
          doctorId : doctorType==="doctor"? doctorId : null,
          subDoctorId : doctorType==="subDoctor"? doctorId : null,
          doctorRole: doctorType,
          priority,
          anaesthesia: anaesthesia.trim(),
          status: "requested",
          disgnosis: disgnosis ? disgnosis.trim() : null,
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          requestedBy,
          requestedByRole,
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

exports.getOTBookings = async (req, res) => {
  const hospitalId = getHospitalId(req);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  const { date, status, priority,searchTerm } = req.query;
  const where = { hospitalId };

  if (date !== undefined) {
    if (!isValidDateOnly(date)) {
      return res.status(400).json({
        success: false,
        message: "date must use the YYYY-MM-DD format.",
      });
    }
    where.scheduleDate = date;
  }

  if (status !== undefined && status !== "all") {
    if (!OT_BOOKING_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${OT_BOOKING_STATUSES.join(", ")}, all.`,
      });
    }
    where.status = status;
  }

  if (priority !== undefined && priority !== "all") {
    if (!OT_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `priority must be one of: ${OT_PRIORITIES.join(", ")}, all.`,
      });
    }
    where.priority = priority;
  }

  try {
    const bookings = await OTBooking.findAll({
      where,
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "patientId", "name", "mobileNumber","email"],
          required: false,
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
        ["scheduleDate", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    let filteredData = bookings.map((item) => {
      const data = item.toJSON();

      if (data.patient) {
        data.patient.name = data.patient.name
          ? decrypt(data.patient.name)
          : "";

        data.patient.email = data.patient.email
          ? decrypt(data.patient.email)
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

    if (typeof searchTerm === "string" && searchTerm.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      const searchableValues = (item) => [
        item.surgeryNo,
        item.procedureName,
        item.specialty,
        item.status,
        item.priority,
        item.patient?.name,
        item.patient?.patientId,
        item.patient?.mobileNumber,
        item.patient?.email,
        item.doctor?.name,
        item.doctor?.doctorId,
        item.subDoctor?.name,
        item.subDoctor?.id,
      ];

      filteredData = filteredData.filter((item) =>
        searchableValues(item).some(
          (value) =>
            value != null &&
            String(value).toLowerCase().includes(keyword)
        )
      );
    }

    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    filteredData.forEach((data) => {
      if (!data.requestedBy) return;

      if (data.requestedByRole === "doctor") {
        doctorIds.push(data.requestedBy);
      } else if (data.requestedByRole === "subDoctor") {
        subDoctorIds.push(data.requestedBy);
      } else {
        receptionistIds.push(data.requestedBy);
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

    let formattedData = filteredData.map((data) => {
      const bookingData = data;

      let recordedByDetails = null;

      if (data.requestedByRole === "doctor") {
        recordedByDetails =
           doctorMap.get(Number(data.requestedBy)) || null;
      } else if (data.requestedByRole === "subDoctor") {
        recordedByDetails =
          subDoctorMap.get(data.requestedBy) || null;
      } else {
        recordedByDetails =
          receptionistMap.get(data.requestedBy) || null;
      }

      let doctor =
        data.doctorRole==="doctor"
          ? {
              ...data.doctor,
              name: data.doctor.name,
            }
          : data.doctorRole==="subDoctor"
          ? {
              ...data.subDoctor,
              name: data.subDoctor.name,
            }
          : null;
    
      return {
        ...bookingData,
        recordedByDetails,
        doctor
      };
    });

    return res.status(200).json({
      success: true,
      message: "OT bookings fetched successfully.",
      data: formattedData,
    });
  } catch (error) {
    console.error("Get OT bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch OT bookings.",
    });
  }
};

exports.getOTBookingDetails = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  try {
    const booking = await OTBooking.findOne({
      where: { id: bookingId, hospitalId },
      include: [
        { 
          model: Patient, 
          as: "patient", 
          attributes: ["id", "patientId", "name", "mobileNumber","email"],
          required: false
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
          required: false 
        },
        { 
          model: SubDoctor, 
          as: "subDoctor", 
          attributes: [
            "id",
            "name",
            "email",
          ],
          required: false 
        },
        { 
          model: OperatingTheatre, 
          as: "theatre", 
           attributes: [
            "id",
            "theatreCode",
            "theatreName",
            "status",
          ],
          required: false 
        },
        {
          model: IPDAdmission,
          as: "ipdAdmission",
          where: { hospitalId },
          attributes: [
            "id",
            "admissionNumber",
            "patientId",
            "admissionDate",
            "status",
          ],
          required: false,
        },
        {
          model: ICUAdmission,
          as: "icuAdmission",
          where: { hospitalId },
          attributes: [
            "id",
            "icuAdmissionNumber",
            "patientId",
            "admissionDate",
            "admissionTime",
            "status",
          ],
          required: false,
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "OT booking request not found.",
      });
    }

    const data = booking.toJSON();
    data.patient = booking.patient ? booking.patient.toJSON() : null;

    data.ipdAdmission =
      booking.ipdAdmission &&
      Number(booking.ipdAdmission.patientId) === Number(booking.patientId)
        ? booking.ipdAdmission.toJSON()
        : null;

    data.icuAdmission =
      booking.icuAdmission &&
      Number(booking.icuAdmission.patientId) === Number(booking.patientId)
        ? booking.icuAdmission.toJSON()
        : null;

    data.theatre = booking.theatre ? booking.theatre.toJSON() : null;

    if (booking.doctorRole==="doctor") {
      data.doctor = booking.doctor.toJSON();
      data.doctor.name = decrypt(data.doctor.name);
    } else if (booking.doctorRole==="subDoctor") {
      data.doctor = booking.subDoctor.toJSON();
      data.doctor.name = decrypt(data.doctor.name);
    } else {
      data.doctor = null;
    }

    if (data.patient) {
      for (const field of ["name", "mobileNumber", "email"]) {
        if (data.patient[field]) {
          data.patient[field] = decrypt(data.patient[field]);
        }
      }
    }

    let requestedByDetails = null;
    
    if (booking.requestedByRole === "doctor") {
      const requesterId = Number(booking.requestedBy);
      if (Number.isInteger(requesterId) && requesterId > 0) {
        const requester = await Doctor.findByPk(requesterId, {
          attributes: ["id", "name", "email", "doctorId"],
        });
        if (requester) {
          requestedByDetails = requester.toJSON();
          requestedByDetails.name = decrypt(requestedByDetails.name);
        }
      }
    } else if (booking.requestedByRole === "subDoctor") {
      const requester = await SubDoctor.findOne({
        where: { id: booking.requestedBy, addedBy: hospitalId },
        attributes: ["id", "name", "email"],
      });
      if (requester) {
        requestedByDetails = requester.toJSON();
        requestedByDetails.name = decrypt(requestedByDetails.name);
      }
    } else {
      const requester = await Receptionist.findOne({
        where: {
          receptionistId: booking.requestedBy,
          doctorId: hospitalId,
        },
        attributes: ["id", "name", "email", "receptionistId"],
      });
      if (requester) {
        requestedByDetails = requester.toJSON();
        requestedByDetails.name = decrypt(requestedByDetails.name);
      }
    }

    return res.status(200).json({
      success: true,
      message: "OT booking details fetched successfully.",
      data: {
        ...data,
        requestedByDetails,
      },
    });
  } catch (error) {
    console.error("Get OT booking details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch OT booking details.",
    });
  }
};

exports.decideOTBookingRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);
  const { action } = req.body;

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "action must be either approve or reject.",
    });
  }

  const assignedById =
      ["doctor", "subDoctor"].includes(req.user.role) 
        ? req.user.id
        : req.user.receptionistId;
        
  const assignedByRole = req.user.role;

  if (!assignedById || !assignedByRole) {
      return res.status(401).json({
        success: false,
        message: "Unable to identify who decide ot request action.",
      });
  }

  try {
    const updatedBooking = await sequelize.transaction(
      async (transaction) => {
        const otBooking = await OTBooking.findOne({
          where: {
            id: bookingId,
            hospitalId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!otBooking) {
          const error = new Error(
            "OT booking request not found."
          );
          error.status = 404;
          throw error;
        }

        if (otBooking.status !== "requested") {
          const error = new Error(
            "Only requested OT bookings can be approved or rejected."
          );
          error.status = 409;
          throw error;
        }

        if (action === "approve") {
          await otBooking.update(
            { status: "scheduled" },
            { transaction }
          );
        } else {
          await otBooking.update(
            { status: "cancelled" },
            { transaction }
          );
        }

        if (action === "approve") {
          const isDoctor = otBooking.doctorRole === "doctor";
          const memberId = isDoctor
            ? otBooking.doctorId
            : otBooking.subDoctorId;

          if (memberId) {
            await OTBookingTeam.create(
              {
                hospitalId,
                otBookingId: otBooking.id,
                teamRole: "primarySurgeon",
                memberType: isDoctor ? "doctor" : "subDoctor",
                memberId: String(memberId),
                assignedById: String(assignedById),
                assignedByRole,
              },
              { transaction }
            );
          }
        }

        return otBooking;
      }
    );

    return res.status(200).json({
      success: true,
      message:
        action === "approve"
          ? "OT request approved and scheduled successfully."
          : "OT request rejected successfully.",
      data: updatedBooking,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Decide OT booking request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update OT booking request.",
    });
  }
};

exports.deleteOTBookingRequest = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const booking = await OTBooking.findOne({
        where: {
          id: bookingId,
          hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!booking) {
        throw createHttpError(404, "OT booking request not found.");
      }

      if (
        ["in_progress","completed",].includes(booking.status)
      ) {
        throw createHttpError(
          409,
          `Only requested, cancelled, postponed, or scheduled OT bookings can be deleted. This Booking is already ${booking.status}`
        );
      }

      await booking.destroy({ transaction });
    });

    return res.status(200).json({
      success: true,
      message: "OT booking request deleted successfully.",
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Delete OT booking request error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete OT booking request.",
    });
  }
};

exports.scheduleOTBooking = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);
  const {
    patientId,
    scheduleDate,
    scheduledStartTime,
    estimatedDurationMinutes,
    otId,
  } = req.body || {};

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  if (!Number.isInteger(Number(patientId)) || Number(patientId) <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid patientId is required.",
    });
  }

  if (!isValidDateOnly(scheduleDate)) {
    return res.status(400).json({
      success: false,
      message: "scheduleDate must use the YYYY-MM-DD format.",
    });
  }

  if (
    typeof scheduledStartTime !== "string" ||
    !/^([01]\d|2[0-3]):([0-5]\d)$/.test(scheduledStartTime)
  ) {
    return res.status(400).json({
      success: false,
      message: "scheduledStartTime must use the HH:mm format.",
    });
  }

  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(scheduledStartTime);
  const normalizedStartTime = `${scheduledStartTime}:00`;
  const startMinutes = Number(timeMatch[1]) * 60 + Number(timeMatch[2]);

  if (
    !Number.isInteger(estimatedDurationMinutes) ||
    estimatedDurationMinutes <= 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "estimatedDurationMinutes must be a positive integer ",
    });
  }

  if (startMinutes + estimatedDurationMinutes >= 24 * 60) {
    return res.status(400).json({
      success: false,
      message:
        "Surgery must finish on scheduleDate.",
    });
  }

  const parsedOtId = Number(otId);
  if (!Number.isInteger(parsedOtId) || parsedOtId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid integer otId is required.",
    });
  }

  const endMinutes = startMinutes + estimatedDurationMinutes;
  const scheduledEndTime = `${String(Math.floor(endMinutes / 60)).padStart(
    2,
    "0"
  )}:${String(endMinutes % 60).padStart(2, "0")}:00`;

  try {
    const updatedBooking = await sequelize.transaction(
      async (transaction) => {
        const booking = await OTBooking.findOne({
          where: {
            id: bookingId,
            patientId: Number(patientId),
            hospitalId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!booking) {
          throw createHttpError(
            404,
            "OT booking was not found for this patient"
          );
        }

        if (!["scheduled"].includes(booking.status)) {
          throw createHttpError(
            409,
            "Only approved OT bookings can be scheduled."
          );
        }

        const theatre = await OperatingTheatre.findOne({
          where: {
            id: parsedOtId,
            hospitalId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!theatre) {
          throw createHttpError(404, "Operating theatre not found.");
        }

        if (
          theatre.isBlock ||
          ["maintenance", "inActive"].includes(theatre.status)
        ) {
          throw createHttpError(
            409,
            "Selected operating theatre is blocked or unavailable."
          );
        }

        const existingPatientBooking = await OTBooking.findOne({
          where: {
            hospitalId,
            patientId: Number(patientId),
            scheduleDate,
            status: {
              [Op.in]: ACTIVE_OT_BOOKING_STATUSES,
            },
            id: {
              [Op.ne]: bookingId,
            },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingPatientBooking) {
          throw createHttpError(
            409,
            "This patient already has an active OT booking on this date."
          );
        }

        const overlappingBooking = await OTBooking.findOne({
          where: {
            hospitalId,
            theatreId: parsedOtId,
            scheduleDate,
            status: {
              [Op.in]: ACTIVE_OT_BOOKING_STATUSES,
            },
            id: {
              [Op.ne]: bookingId,
            },
            scheduledStartTime: {
              [Op.lt]: scheduledEndTime,
            },
            scheduledEndTime: {
              [Op.gt]: normalizedStartTime,
            },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (overlappingBooking) {
          throw createHttpError(
            409,
            "Operating theatre already has a booking during that time."
          );
        }

        await booking.update(
          {
            theatreId:parsedOtId,
            scheduleDate,
            estimatedDurationMinutes,
            scheduledStartTime: normalizedStartTime,
            scheduledEndTime,
             status: "scheduled",
          },
          { transaction }
        );

        let [checklist, created] =
          await OTPreoperativeChecklist.findOrCreate({
            where: {
              otBookingId: booking.id,
            },
            defaults: {
              hospitalId,
              status: "pending",
              createdById: req.user.id,
              createdByRole: req.user.role,
            },
            transaction,
          });

        if (Number(checklist.hospitalId) !== Number(hospitalId)) {
          throw createHttpError(
            409,
            "Checklist hospital does not match the OT booking."
          );
        }

        return {
          booking,
          checklistCreated: created,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: updatedBooking.checklistCreated
      ? "OT booking scheduled successfully and preoperative checklist created successfully."
      : "OT booking scheduled successfully.",
      data: updatedBooking,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Schedule OT booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to schedule OT booking.",
    });
  }
};

exports.startOTBooking = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  try {
    const updatedBooking = await sequelize.transaction(
      async (transaction) => {
        const booking = await OTBooking.findOne({
          where: {
            id: bookingId,
            hospitalId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!booking) {
          throw createHttpError(404, "OT booking not found.");
        }

        if (booking.status !== "scheduled") {
          throw createHttpError(
            409,
            "Only scheduled OT bookings can be started."
          );
        }

        const now = new Date();
        const pad = (value) => String(value).padStart(2, "0");
        const actualStartDate = [
          now.getFullYear(),
          pad(now.getMonth() + 1),
          pad(now.getDate()),
        ].join("-");

        if (actualStartDate < booking.scheduleDate) {
          throw createHttpError(
            409,
            "OT surgery cannot be started before its scheduled date."
          );
        }

        const actualStartTime = [
          pad(now.getHours()),
          pad(now.getMinutes()),
          pad(now.getSeconds()),
        ].join(":");

        await booking.update(
          {
            status: "in_progress",
            actualStartDate,
            actualStartTime,
          },
          { transaction }
        );

        return booking;
      }
    );

    return res.status(200).json({
      success: true,
      message: "OT surgery started successfully.",
      data: updatedBooking,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Start OT booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start OT surgery.",
    });
  }
};
