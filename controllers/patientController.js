const { Op } = require("sequelize");
const moment = require("moment-timezone");
const {
  Patient,
  Appointment,
  Doctor,
  SubDoctor,
  SetFee,
  AuditLog,
  sequelize,
} = require("../models");
const { decrypt } = require("../utils/cryptography");
const { update } = require("../websocket");
const { transformWithMapping } = require("../utils/transformWithMapping");
const constants = require("../utils/constants");
const { maskData } = require("../utils/maskData");
const {
  checkDoctorAvailability,
} = require("../services/doctorAvailabilityService");
const { sendAppointmentReminderEmail } = require("../services/appointmentReminderService");

const generateUniquePatientId = async (name) => {
  const nameParts = name.split(" ");
  const initials = nameParts
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
    uniqueId = `${initials}${randomDigits}`;

    const existingDoctor = await Patient.findOne({
      where: { patientId: uniqueId },
    });

    if (!existingDoctor) {
      isUnique = true;
    }
  }

  return uniqueId;
};

const patientController = {
  async addPatient(req, res) {
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;
    const {
      name,
      mobileNumber,
      address,
      email,
      age,
      gender,
      reason,
      process,
      date,
      appointmentTime,
      dateOfBirth,
      bloodGroup,
      referredBy,
      doctorId,
      doctorType,
    } = payload || {};

    if (!name || !mobileNumber || !reason || !process || !date || !appointmentTime) {
      return res.status(400).json({
        error: "Missing required fields. Please ensure name, mobileNumber, reason, process, date, and appointmentTime are provided.",
      });
    }

    const appointmentDate = new Date(date);

    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    if (appointmentDate < new Date().setHours(0, 0, 0, 0)) {
      return res
        .status(400)
        .json({ error: "Appointment date cannot be in the past" });
    }

    if (
      req.user.role === "receptionist" &&
      (!doctorId || !["doctor", "subDoctor"].includes(doctorType))
    ) {
      return res.status(400).json({ error: "Doctor is required" });
    }

    // const patientPlanLimit = await checkPlanLimit({
    //   hospitalId: req.user.hospitalId,
    //   resource: "patients",
    // });

    // if (!patientPlanLimit.allowed) {
    //   return res
    //     .status(patientPlanLimit.status)
    //     .json(patientPlanLimit.response);
    // }

    // const appointmentPlanLimit = await checkPlanLimit({
    //   hospitalId: req.user.hospitalId,
    //   resource: "appointments",
    // });

    // if (!appointmentPlanLimit.allowed) {
    //   return res
    //     .status(appointmentPlanLimit.status)
    //     .json(appointmentPlanLimit.response);
    // }

    const transaction = await sequelize.transaction();

    try {
      const {
        available,
        reason: noAvailabilityReason,
        slot,
        appointmentCount = 0,
      } = await checkDoctorAvailability(
        req.user.role === "subDoctor"
          ? null
          : doctorType === "subDoctor"
            ? null
            : doctorId || req.user.id,
        req.user.role === "subDoctor"
          ? req.user.id
          : doctorType === "subDoctor"
            ? doctorId
            : null,
        date,
        appointmentTime
      );

      if (!available) {
        if (transaction && !transaction.finished) await transaction.rollback();
        return res.status(400).json({ error: noAvailabilityReason });
      }
      const doctor = await Doctor.findOne({
        where: { id: req.user.hospitalId },
        attributes: ["mapping"],
        transaction,
      });

      const feeEntry = await SetFee.findOne({
        where: { doctorId: req.user.hospitalId, feesFor: reason },
        transaction,
      });

      const selectedFee = feeEntry ? feeEntry.fees : 0;

      const patientId = await generateUniquePatientId(name);

      const mapping = (doctor && doctor.mapping) ? (JSON.parse(decrypt(doctor.mapping)) || {}) : {};
      const nameSearch = transformWithMapping(name, mapping);
      const mobileSearch = transformWithMapping(mobileNumber, mapping);

      const existingPatient = await Patient.findOne({
        where: {
          doctorId: req.user.hospitalId,
          nameSearch,
          mobileSearch,
        },
        transaction,
      });

      if (existingPatient) {
        if (transaction && !transaction.finished) await transaction.rollback();
        return res.status(400).json({ error: "Patient already exists" });
      }

      const patient = await Patient.create(
        {
          name,
          nameSearch,
          mobileSearch,
          patientId,
          mobileNumber,
          address,
          email,
          age,
          gender,
          dateOfBirth,
          bloodGroup,
          referredBy,
          doctorId: req.user.hospitalId,
        },
        { transaction }
      );

      const appointment = await Appointment.create(
        {
          patientId: patient.id,
          appointmentNumber: (appointmentCount || 0) + 1,
          reason,
          date,
          appointmentTime,
          process,
          fees: selectedFee,
          extraFees: 0,
          ...(req.user.role === "receptionist"
            ? {
              doctorId: doctorType === "doctor" ? doctorId : null,
              subDoctorId: doctorType === "subDoctor" ? doctorId : null,
            }
            : req.user.role === "doctor"
              ? {
                doctorId: doctorType === "subDoctor" ? null : req.user.id,
                subDoctorId: doctorType === "subDoctor" ? doctorId : null,
              }
              : { subDoctorId: req.user.id }),
        },
        { transaction }
      );

      await AuditLog.create(
        {
          action: constants.ADD_PATIENT,
          details: `Added patient ${name} and booked appointment ID ${appointment.id}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Patient",
          entityId: patient.id,
          oldValue: null,
          newValue: maskData(
            {
              name,
              mobileNumber,
              address,
              email,
              age,
              gender,
              dateOfBirth,
              bloodGroup,
            },
            false
          ),
          status: "success",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      try {
        if (moment(appointment.date).isSame(moment(), "day")) {
          update(
            {
              event: "newAppointment",
              appointment: {
                ...appointment.toJSON(),
                patient,
              },
            },
            appointment.doctorId || appointment.subDoctorId
          );
        }

        sendAppointmentReminderEmail({
          toEmail: patient.email ? decrypt(patient.email) : null,
          patientName: patient.name ? decrypt(patient.name) : patient.name,
          date: appointment.date,
          appointmentTime: appointment.appointmentTime,
          reason: appointment.reason ? decrypt(appointment.reason) : appointment.reason,
        });
      } catch (postCommitError) {
        console.error(
          "[addPatient] Post-commit step failed (patient was still saved successfully):",
          postCommitError
        );
      }

      res.status(201).json({
        message: "Patient added successfully",
        appointment,
        patient,
      });
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      console.error("[addPatient Error]:", error);
      res.status(500).json({ error: error.message || "Failed to add patient" });
    }
  },

  async bookAppointment(req, res) {
    const patientId = req.params.id;
    const { reason, date, process, appointmentTime, doctorId, doctorType } =
      req.body;

    const appointmentDate = new Date(date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    if (appointmentDate < new Date().setHours(0, 0, 0, 0)) {
      return res
        .status(400)
        .json({ error: "Appointment date cannot be in the past" });
    }

    if (
      req.user.role === "receptionist" &&
      (!doctorId || !["doctor", "subDoctor"].includes(doctorType))
    ) {
      return res.status(400).json({ error: "Doctor is required" });
    }

    // const appointmentPlanLimit = await checkPlanLimit({
    //   hospitalId: req.user.hospitalId,
    //   resource: "appointments",
    // });

    // if (!appointmentPlanLimit.allowed) {
    //   return res
    //     .status(appointmentPlanLimit.status)
    //     .json(appointmentPlanLimit.response);
    // }

    const transaction = await sequelize.transaction();

    try {
      const patient = await Patient.findOne({
        where: { id: patientId },
        transaction,
      });

      if (!patient) {
        await transaction.rollback();
        return res.status(404).json({ error: "Patient not found" });
      }

      const {
        available,
        reason: noAvailabilityReason,
        slot,
        appointmentCount,
      } = await checkDoctorAvailability(
        req.user.role === "subDoctor"
          ? null
          : doctorType === "subDoctor"
            ? null
            : doctorId || req.user.id,
        req.user.role === "subDoctor"
          ? req.user.id
          : doctorType === "subDoctor"
            ? doctorId
            : null,
        date,
        appointmentTime
      );

      if (!available) {
        await transaction.rollback();
        return res.status(400).json({ error: noAvailabilityReason });
      }

      const feeEntry = await SetFee.findOne({
        where: { doctorId: patient.doctorId, feesFor: reason },
        transaction,
      });

      const selectedFee = feeEntry ? feeEntry.fees : 0;

      const existingAppointment = await Appointment.findOne({
        where: {
          patientId,
          date: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
        transaction,
      });

      if (existingAppointment) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Patient already has an appointment on this date" });
      }

      const appointment = await Appointment.create(
        {
          reason,
          date,
          process,
          appointmentTime,
          patientId,
          appointmentNumber: appointmentCount + 1,
          fees: selectedFee,
          extraFees: 0,
          ...(req.user.role === "receptionist"
            ? {
              doctorId: doctorType === "doctor" ? doctorId : null,
              subDoctorId: doctorType === "subDoctor" ? doctorId : null,
            }
            : req.user.role === "doctor"
              ? {
                doctorId: doctorType === "subDoctor" ? null : req.user.id,
                subDoctorId: doctorType === "subDoctor" ? doctorId : null,
              }
              : { subDoctorId: req.user.id }),
        },
        { transaction }
      );

      const appointmentDataForAudit = {
        id: appointment.id,
        appointmentNumber: appointment.appointmentNumber,
        date: appointment.date,
        time: appointment.appointmentTime,
        process: appointment.process,
      };

      await AuditLog.create(
        {
          action: constants.BOOK_APPOINTMENT,
          details: `Booked appointment ID ${appointment.id} for patient ${patient.patientId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          oldValue: null,
          newValue: maskData(appointmentDataForAudit),
          status: "success",
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
          endpoint: req.url,
        },
        { transaction }
      );

      await transaction.commit();

      // Wrapped separately so nothing here can turn a successful booking
      // into a 500 error response.
      try {
        const appoDate = moment(appointment.date);

        if (appoDate.isSame(moment(), "day")) {
          update(
            {
              event: "newAppointment",
              appointment: {
                ...appointment.toJSON(),
                patient,
              },
            },
            appointment.doctorId || appointment.subDoctorId
          );
        }

        // --- fire-and-forget reminder, never blocks/affects the response ---
        sendAppointmentReminderEmail({
          toEmail: patient.email ? decrypt(patient.email) : null,
          patientName: patient.name ? decrypt(patient.name) : patient.name,
          date: appointment.date,
          appointmentTime: appointment.appointmentTime,
          reason: appointment.reason ? decrypt(appointment.reason) : appointment.reason,
        });
        // --- end reminder ---
      } catch (postCommitError) {
        console.error(
          "[bookAppointment] Post-commit step failed (appointment was still booked successfully):",
          postCommitError
        );
      }

      res.status(201).json({
        message: "Appointment booked successfully",
        appointment,
        patient,
      });
    } catch (error) {
      console.log(error);
      if (transaction && !transaction.finished) await transaction.rollback();
      return res.status(500).json({ error: "Failed to book appointment" });
    }
  },

  async getPatients(req, res) {
    try {
      const {
        date,
        page = 1,
        limit = 10,
        searchTerm,
        appointmentTime,
        doctorId,
        doctorType,
      } = req.query;

      const offset = (page - 1) * limit;

      const doctor = await Doctor.findOne({
        where: { id: req.user.hospitalId },
        attributes: ["mapping"],
      });

      const patientWhere = { doctorId: req.user.hospitalId };
      const appointmentWhere = {};

      if (doctorId) {
        if (doctorType === "doctor") appointmentWhere["doctorId"] = doctorId;
        else if (doctorType === "subDoctor")
          appointmentWhere["subDoctorId"] = doctorId;
      }
      if (req.user.role === "subDoctor")
        appointmentWhere["subDoctorId"] = req.user.id;

      if (searchTerm && searchTerm.length > 0) {
        let mappingObj = {};
        if (doctor && doctor.mapping) {
          try {
            const decrypted = decrypt(doctor.mapping);
            mappingObj = decrypted ? JSON.parse(decrypted) : {};
          } catch (e) {
            mappingObj = {};
          }
        }
        const transformSearchTerm = transformWithMapping(
          searchTerm,
          mappingObj
        );
        patientWhere[Op.or] = [
          { patientId: { [Op.like]: `%${transformSearchTerm}%` } },
          { nameSearch: { [Op.like]: `%${transformSearchTerm}%` } },
        ];
      }

      if (date) appointmentWhere.date = moment(date).format("YYYY-MM-DD");
      if (appointmentTime) appointmentWhere.appointmentTime = appointmentTime;

      const patients = await Appointment.findAndCountAll({
        where: date
          ? appointmentWhere
          : {
            ...appointmentWhere,
            date: {
              [Op.eq]: sequelize.literal(`(
                  SELECT MAX(a2.date)
                  FROM appointments AS a2
                  WHERE a2.patientId = Appointment.patientId
                )`),
            },
          },
        include: [
          {
            model: Patient,
            as: "patient",
            where: patientWhere,
            required: true,
          },
        ],
        distinct: true,
        limit: Number(limit),
        offset: Number(offset),
        order: [["patientId", "DESC"]],
      });

      await AuditLog.create({
        action: constants.GET_PATIENTS,
        details: `User(${req.user.role} - ${req.user.id}) retrieved the patients`,
        hospitalId: req.user.hospitalId,
        doctorId: req.user.role === "doctor" ? req.user.id : null,
        subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
        receptionistId: req.user.role === "receptionist" ? req.user.id : null,
        role: req.user.role,
        token: req.header("Authorization")?.split(" ")[1],
        entity: "Patient",
        status: "success",
        module: "Patient Management",
        endpoint: req.url,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json({
        patients: patients.rows,
        pagination: {
          totalRecords: patients.count,
          totalPages: Math.ceil(patients.count / limit),
          currentPage: Number(page),
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      console.error("[getPatients Error]:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async getPatientsForAppointment(req, res) {
    const { searchTerm } = req.query;
    try {
      const doctor = await Doctor.findByPk(req.user.hospitalId, {
        attributes: ["mapping"],
      });

      const patientWhereClause = { doctorId: req.user.hospitalId };
      if (searchTerm) {
        const transformSearchTerm = transformWithMapping(
          searchTerm,
          JSON.parse(decrypt(doctor.mapping)) || {}
        );
        patientWhereClause[Op.or] = [
          {
            nameSearch: {
              [Op.like]: `%${transformSearchTerm}%`,
            },
          },
          {
            mobileSearch: {
              [Op.like]: `%${transformSearchTerm}%`,
            },
          },
        ];
      }

      const patients = await Patient.findAll({
        where: patientWhereClause,
        attributes: [
          "id",
          "name",
          "patientId",
          "mobileNumber",
          "age",
          "gender",
          "address",
          "dateOfBirth",
          "bloodGroup",
        ],
        include: [
          {
            model: Appointment,
            as: "appointments",
            attributes: [
              "id",
              "date",
              "status",
              "appointmentTime",
              "appointmentNumber",
              "doctorId",
              "subDoctorId",
            ],
            where: {
              status: "out",
            },
            order: [["date", "DESC"]],
            required: false,
            limit: 1,
            saperate: true,
            include: [
              { model: Doctor, as: "doctor", attributes: ["id", "name"] },
              { model: SubDoctor, as: "subDoctor", attributes: ["id", "name"] },
            ],
          },
        ],
      });

      res.status(200).json({ patients });
    } catch (error) {
      res.status(500).json({ error: "Failed to get patients" });
    }
  },

  async setToxicity(req, res) {
    const { id } = req.params;
    const transaction = await sequelize.transaction();

    try {
      const patient = await Patient.findByPk(id, {
        attributes: ["id", "toxicity"],
        transaction,
      });
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const oldToxicity = patient.toxicity;
      patient.toxicity = !oldToxicity;

      await patient.save({ transaction });

      await AuditLog.create(
        {
          action: oldToxicity ? constants.UNSET_TOXIC : constants.SET_TOXIC,
          details: `${oldToxicity ? "Unset" : "Set"} patient (${id}) toxic`,
          hospitalId: req.user.hospitalId,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          receptionistId: null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Patient",
          entityId: patient.id,
          oldValue: oldToxicity,
          newValue: patient.toxicity,
          status: "success",
          module: "Patient Management",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        { transaction }
      );

      await transaction.commit();

      await patient.save();
      res
        .status(200)
        .json({ message: "Patient spacial category status updated" });
    } catch (error) {
      console.log(error);

      if (transaction) await transaction.rollback();
      res.status(500).json({
        error: "Failed to update spacial category status",
      });
    }
  },

  async getPatientsCount(req, res) {
    const { doctorId, doctorType } = req.query;

    try {
      const whereClause = {
        date: {
          [Op.between]: [
            moment().tz("Asia/Kolkata").startOf("day").toDate(),
            moment().tz("Asia/Kolkata").endOf("day").toDate(),
          ],
        },
      };
      if (req.user.role === "doctor") whereClause.doctorId = req.user.id;
      else if (req.user.role === "subDoctor")
        whereClause.subDoctorId = req.user.id;
      else if (
        doctorId &&
        (doctorType === "doctor" || doctorType === "subDoctor")
      )
        whereClause[doctorType === "doctor" ? "doctor" : "subDoctor"] =
          doctorId;

      const include = [
        {
          model: Patient,
          as: "patient",
          where: { doctorId: req.user.hospitalId },
        },
      ];

      const [todaysPatients, waitingPatients, completedPatients] =
        await Promise.all([
          Appointment.count({
            where: whereClause,
            include,
          }),
          Appointment.count({
            where: {
              ...whereClause,
              status: null,
            },
            include,
          }),
          Appointment.count({
            where: {
              ...whereClause,
              status: "out",
            },
            include,
          }),
        ]);

      return res.status(200).json({
        data: {
          todaysPatients,
          waitingPatients,
          completedPatients,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch patients count",
      });
    }
  },

  async getAllTimePatientCount(req, res) {
    try {
      const count = await Appointment.count({
        where: {
          ...(req.user.role === "doctor"
            ? { doctorId: req.user.id, }
            : { subDoctorId: req.user.id }),
        },
        col: "patientId",
        distinct: true,
      });

      res.status(200).json({
        data: {
          count,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to get patients count",
      });
    }
  },
};

module.exports = patientController;
module.exports.generateUniquePatientId = generateUniquePatientId;