const { Op } = require("sequelize");
const moment = require("moment-timezone");

const {
  Patient,
  Appointment,
  AuditLog,
  Doctor,
  SubDoctor,
  sequelize,
} = require("../models");
const {
  getDecryptedDocumentAsBase64,
  decrypt,
} = require("../utils/cryptography");
const { update } = require("../websocket");
const constants = require("../utils/constants");
const { maskData } = require("../utils/maskData");
const { transformWithMapping } = require("../utils/transformWithMapping");
const {
  checkDoctorAvailability,
} = require("../services/doctorAvailabilityService");

const patientController = {
  async addParameters(req, res) {
    const appointmentId = req.params.id;
    const { parameters } = req.body;

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "parameters", "status", "doctorId", "subDoctorId"],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't add parameters, Appointment is cancelled." });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Cannot add parameters to future appointments" });
      }

      const { parameters: oldParameters } = appointment.parameters
        ? { ...appointment.toJSON() }
        : {};

      appointment.parameters = parameters;

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${
            oldParameters
              ? constants.CHANGE_PARAMETERS
              : constants.ADD_PARAMETERS
          }`,
          details: `${
            oldParameters ? "Changed" : "Added"
          } parameters to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          status: "success",
          module: "Appointment Management",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
          oldValue: oldParameters ? maskData(oldParameters) : null,
          newValue: maskData(parameters),
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "parametersUpdated",
          appointmentId,
          parameters,
        },
        appointment.doctorId || appointment.subDoctorId
      );

      res.status(200).json({ message: "Parameters added successfully" });
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      res.status(500).json({ error: "Failed to add parameters" });
    }
  },

  async addPaymentMode(req, res) {
    const appointmentId = req.params.id;
    const { paymentMode } = req.body;

    if (paymentMode !== "Cash" && paymentMode !== "Online") {
      return res.status(400).json({ error: "Invalid payment mode" });
    }

    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "paymentMode", "status", "doctorId", "subDoctorId"],
      });

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status === "cancel") {
        return res
          .status(400)
          .json({ error: "Can't add payment mode, Appointment is cancelled." });
      }

      if (appointment.date > new Date()) {
        return res
          .status(400)
          .json({ error: "Cannot add payment mode to future appointments" });
      }

      appointment.paymentMode = paymentMode;

      await appointment.save();

      res.status(200).json({ message: "Payment mode updated successfully" });
    } catch (error) {
      res.status(500).json({
        error: "Failed to update payment mode",
      });
    }
  },

  async addPrescription(req, res) {
    const appointmentId = req.params.id;

    if (!req.file && !req.body.base64Image) {
      return res.status(400).json({ error: "No file or image data uploaded" });
    }

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "document", "status", "doctorId", "subDoctorId"],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't add prescription, Appointment is cancelled." });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Cannot add prescription for future appointments" });
      }

      let fileData;

      if (req.file) {
        fileData = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`;
      } else if (req.body.base64Image) {
        const base64Image = req.body.base64Image;
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return res.status(400).json({ error: "Invalid base64 image format" });
        }
        fileData = base64Image;
      }

      const oldPrescription = appointment.document;
      appointment.document = fileData;

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${
            oldPrescription
              ? constants.CHANGE_PRESCRIPTION
              : constants.ADD_PRESCRIPTION
          }`,
          details: `${
            oldPrescription ? "Changed" : "Added"
          } prescription to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          status: "success",
          module: "Appointment Management",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      res.status(200).json({
        message: "Prescription added successfully",
        document: fileData,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      res.status(500).json({
        error: "Failed to add prescription",
      });
    }
  },

  async submitAppointment(req, res) {
    const {
      followUp,
      note,
      fees,
      extraFees,
      investigation,
      chiefComplaints,
      diagnosis,
      prescription,
      language
    } = req.body;

    if (fees) {
      const parsedFees = parseFloat(fees);
      if (Number.isNaN(parsedFees) || parsedFees <= 0) {
        return res
          .status(400)
          .json({ error: "Fees must be a valid number greater than 0" });
      }
    }

    if (extraFees) {
      const parsedExtraFees = parseFloat(extraFees);
      if (Number.isNaN(parsedExtraFees) || parsedExtraFees < 0) {
        return res.status(400).json({
          error: "Extra fees must be a valid number (>= 0)",
        });
      }
    }

    const followUpDate = new Date(followUp).setHours(0, 0, 0, 0);

    if (followUpDate <= new Date().setHours(0, 0, 0, 0)) {
      return res
        .status(400)
        .json({ error: "Follow-up date cannot be in the past" });
    }

    const appointmentId = req.params.id;

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(
        appointmentId,
        {
          attributes: [
            "id",
            "followUp",
            "note",
            "fees",
            "extraFees",
            "investigation",
            "chiefComplaints",
            "diagnosis",
            "status",
            "doctorId",
            "subDoctorId",
          ],
        },
        {
          transaction,
        }
      );

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: "Can't submit appointment, Appointment is cancelled.",
        });
      }

      if (appointment.date > new Date()) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Cannot submit future appointments" });
      }

      const oldValue = {
        ...appointment.toJSON(),
      };
      const status = appointment.status;

      appointment.note = note || null;
      appointment.followUp = followUp || null;
      appointment.investigation = investigation ? investigation : null;
      appointment.chiefComplaints = chiefComplaints ? chiefComplaints : null;
      appointment.diagnosis = diagnosis ? diagnosis : null;
      appointment.language=language ? language : null;

      if (fees && appointment.status !== "out") {
        appointment.fees = appointment.fees + parseInt(fees, 10);
      }
      appointment.extraFees = parseInt(extraFees, 10);
      appointment.prescription = Array.isArray(prescription)
        ? prescription
        : null;

      appointment.status = "out";

      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${
            status === null || status === "in"
              ? constants.SUBMIT_APPOINTMENT
              : constants.RE_SUBMIT_APPOINTMENT
          }`,
          details: `${
            status === null || status === "in" ? "Submitted" : "Re-submitted"
          } appointment to appointment ID ${appointmentId}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          status: "success",
          module: "Appointment Management",
          oldValue:
            oldValue.followUp ||
            oldValue.investigation ||
            oldValue.chiefComplaints ||
            oldValue.diagnosis ||
            oldValue.prescription
              ? maskData({
                  followUp: oldValue.followUp,
                  note: oldValue.note,
                  investigation: oldValue.investigation,
                  chiefComplaints: oldValue.chiefComplaints,
                  diagnosis: oldValue.diagnosis,
                  prescription: oldValue.prescription,
                })
              : null,
          newValue: maskData({
            followUp,
            note,
            investigation,
            chiefComplaints,
            diagnosis,
            prescription,
          }),
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "updatedAppointment",
          appointment: {
            appointmentId: appointment.id,
            fees: appointment.fees,
            extraFees: appointment.extraFees,
            followUp: appointment.followUp,
            note: appointment.note,
            prescription: appointment.prescription,
          },
        },
        appointment.doctorId || appointment.subDoctorId
      );

      res.status(200).json({ message: "Prescription submitted successfully" });
    } catch (error) {
      console.log(error);
      
      if (transaction) await transaction.rollback();
      res.status(500).json({
        error: "Failed to add prescription",
      });
    }
  },

  async getTodaysAppointments(req, res) {
    const { searchTerm, date, appointmentTime, doctorId, doctorType } =
      req.query;

    try {
      const targetDate = date ? date : moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
      const appointmentWhere = {
        date: {
          [Op.between]: [
            moment(targetDate).tz("Asia/Kolkata").startOf("day").toDate(),
            moment(targetDate).tz("Asia/Kolkata").endOf("day").toDate(),
          ],
        },
      };

      if (req.user.role === "doctor" && !doctorId) {
        appointmentWhere.doctorId = req.user.id;
      }

      if (req.user.role === "subDoctor") {
        appointmentWhere.subDoctorId = req.user.id;
      }

      if (doctorId && (doctorType === "doctor" || doctorType === "subDoctor")) {
        appointmentWhere[doctorType === "doctor" ? "doctorId" : "subDoctorId"] =
          doctorId;
      }

      if (appointmentTime) {
        appointmentWhere.appointmentTime = appointmentTime;
      }

      const doctor = await Doctor.findOne({
        where: { id: req.user.hospitalId },
        attributes: ["mapping"],
      });

      const patientWhere = { doctorId: req.user.hospitalId };

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

      const appointments = await Appointment.findAll({
        where: appointmentWhere,
        include: [
          {
            model: Patient,
            as: "patient",
            where: patientWhere,
            required: true,
            
          },
          {
            model: Doctor,
            as: "doctor",
            required: false,
            attributes:["id","name","mobileNumber","department","medicalDegree","specialization","prescriptionDisplay","signature"]
          },
          {
            model: SubDoctor,
            as: "subDoctor",
            required: false,
            attributes:["id","name","mobileNumber","department","qualification","specialization","prescriptionDisplay","signature"]
          },
        ],
        order: [
          [
            sequelize.literal(
              `CASE WHEN status IS NULL THEN 1 WHEN status = 'out' THEN 2 WHEN status = 'cancel' THEN 3 ELSE 0 END`
            ),
            "ASC",
          ],
          ["appointmentTime", "ASC"],
          ["createdAt", "ASC"],
        ],
      });

      // const data = appointments.map((appointment) => ({
      //   ...appointment.toJSON(),
      //   doctorType : appointment.doctorId
      //     ? "doctor"
      //     : appointment.subDoctorId
      //       ? "subDoctor"
      //       : null,
      //   document: appointment.document
      //     ? getDecryptedDocumentAsBase64(appointment.document)
      //     : null,
      //   department: appointment.doctorId 
      //     ? appointment.doctor.department 
      //     : appointment.subDoctorId 
      //       ? appointment.subDoctor.department 
      //       : null,

      //   doctor: appointment.doctor
      //     ? {
      //         ...appointment.doctor,
      //         signature: getDecryptedDocumentAsBase64(
      //           appointment.doctor.signature
      //         ),
      //       }
      //     : null,

      //   subDoctor: appointment.subDoctor
      //     ? {
      //         ...appointment.subDoctor,
      //         signature: getDecryptedDocumentAsBase64(
      //           appointment.subDoctor.signature
      //         ),
      //       }
      //     : null,
      // }));

      const data = appointments.map((appointment) => {
        const appointmentData = appointment.toJSON();

        const doctor = appointment.doctor
          ? appointment.doctor.toJSON()
          : null;

        const subDoctor = appointment.subDoctor
          ? appointment.subDoctor.toJSON()
          : null;

        return {
          ...appointmentData,

          doctorType: appointment.doctorId
            ? "doctor"
            : appointment.subDoctorId
              ? "subDoctor"
              : null,

          department: appointment.doctorId
            ? doctor?.department
            : appointment.subDoctorId
              ? subDoctor?.department
              : null,

          document: getDecryptedDocumentAsBase64(appointment.document),

          doctor: doctor
            ? {
                ...doctor,
                signature: getDecryptedDocumentAsBase64(doctor.signature),
              }
            : null,

          subDoctor: subDoctor
            ? {
                ...subDoctor,
                signature: getDecryptedDocumentAsBase64(subDoctor.signature),
              }
            : null,
        };
      });

      const countWhere = {
        ...appointmentWhere,
      };

      if ((doctorType || req.user.role) === "doctor") {
        countWhere.doctorId = doctorId || req.user.id;
      } else if ((doctorType || req.user.role) === "subDoctor") {
        countWhere.subDoctorId = doctorId || req.user.id;
      }

      const [pendingCnt, completeCnt] = await Promise.all([
        Appointment.count({
          where: {
            ...countWhere,
            status: null,
          },
          include: [
            {
              model: Patient,
              as: "patient",
              where: patientWhere,
              required: true,
            },
          ],
        }),
        Appointment.count({
          where: {
            ...countWhere,
            status: "out",
          },
          include: [
            {
              model: Patient,
              as: "patient",
              where: patientWhere,
              required: true,
            },
          ],
        }),
      ]);

      await AuditLog.create({
        action: constants.GET_APPOINTMENTS,
        hospitalId: req.user.hospitalId,
        receptionistId: req.user.role === "receptionist" ? req.user.id : null,
        doctorId: req.user.role === "doctor" ? req.user.id : null,
        subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
        role: req.user.role,
        token: req.header("Authorization")?.split(" ")[1],
        entity: "Appointment",
        status: "success",
        module: "Appointment Management",
        endpoint: req.url,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json({
        appointments: data,
        stats: { pendingCnt, completeCnt },
      });
    } catch (error) {
      console.error("[getTodaysAppointments Error]:", error);
      res.status(500).json({ error: "Failed to get appointments" });
    }
  },

  async getPatientAppointments(req, res) {
    const patientId = req.params.id;

    try {
      const appointments = await Patient.findOne({
        where: { id: patientId, doctorId: req.user.hospitalId },
        include: [
          {
            model: Appointment,
            as: "appointments",
            include: [
              {
                model: Doctor,
                as: "doctor",
                required: false,
                attributes:["id","name","mobileNumber","department","medicalDegree","specialization","prescriptionDisplay","signature"]
              },
              {
                model: SubDoctor,
                as: "subDoctor",
                required: false,
                attributes:["id","name","mobileNumber","department","qualification","specialization","prescriptionDisplay","signature"]
              },
            ],
          },
        ],
      });

      if (!appointments) {
        return res.status(404).json({ error: "Patient not found" });
      }

      // const data = appointments.appointments.map((appointment) => ({
      //   ...appointment.toJSON(),
      //   doctorType : appointment.doctorId
      //     ? "doctor"
      //     : appointment.subDoctorId
      //       ? "subDoctor"
      //       : null,
      //   department: appointment.doctorId 
      //     ? appointment.doctor.department 
      //     : appointment.subDoctorId 
      //       ? appointment.subDoctor.department 
      //       : null,
      //   document: getDecryptedDocumentAsBase64(appointment.document),
      //   doctor: appointment.doctor
      //     ? {
      //         ...appointment.doctor,
      //         signature: getDecryptedDocumentAsBase64(
      //           appointment.doctor.signature
      //         ),
      //       }
      //     : null,

      //   subDoctor: appointment.subDoctor
      //     ? {
      //         ...appointment.subDoctor,
      //         signature: getDecryptedDocumentAsBase64(
      //           appointment.subDoctor.signature
      //         ),
      //       }
      //     : null,


      // }));
      const data = appointments.appointments.map((appointment) => {
        const appointmentData = appointment.toJSON();

        const doctor = appointment.doctor
          ? appointment.doctor.toJSON()
          : null;

        const subDoctor = appointment.subDoctor
          ? appointment.subDoctor.toJSON()
          : null;

        return {
          ...appointmentData,

          doctorType: appointment.doctorId
            ? "doctor"
            : appointment.subDoctorId
              ? "subDoctor"
              : null,

          department: appointment.doctorId
            ? doctor?.department
            : appointment.subDoctorId
              ? subDoctor?.department
              : null,

          document: getDecryptedDocumentAsBase64(appointment.document),

          doctor: doctor
            ? {
                ...doctor,
                signature: getDecryptedDocumentAsBase64(doctor.signature),
              }
            : null,

          subDoctor: subDoctor
            ? {
                ...subDoctor,
                signature: getDecryptedDocumentAsBase64(subDoctor.signature),
              }
            : null,
        };
      });

      await AuditLog.create({
        action: constants.GET_PATIENT_APPOINTMENTS,
        hospitalId: req.user.hospitalId,
        receptionistId: req.user.role === "receptionist" ? req.user.id : null,
        doctorId: req.user.role === "doctor" ? req.user.id : null,
        subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
        role: req.user.role,
        token: req.header("Authorization")?.split(" ")[1],
        entity: "Appointment",
        status: "success",
        module: "Appointment Management",
        endpoint: req.url,
        ipAddress: req.clientIp,
        userAgent: req.headers["user-agent"],
      });

      res.status(200).json({
        appointments: {
          ...appointments.toJSON(),
          appointments: data,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get appointments" });
    }
  },

  async setAppointmentStatus(req, res) {
    const appointmentId = req.params.id;
    const { status } = req.body;

    if (!["in", "out"].includes(status)) {
      return res.status(400).json({ error: "Invalid status provided." });
    }

    const transaction = await sequelize.transaction();
    try {
      const appointment = await Appointment.findByPk(appointmentId, {
        attributes: ["id", "status", "doctorId", "subDoctorId"],
        include: [{ model: Patient, as: "patient" }],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found." });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status === "cancel") {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't change status, Appointment is cancelled." });
      }

      if (appointment.status === null && status === "out") {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: "Cannot set status to out if it's not set to in first.",
        });
      }

      if (appointment.status === "out") {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ error: "Appointment is already out." });
      }

      await Appointment.update(
        { status: "out" },
        {
          where: {
            status: "in",
            doctorId: appointment.doctorId,
            subDoctorId: appointment.subDoctorId,
          },
          transaction,
        }
      );

      appointment.status = status;
      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: `${
            status === "in"
              ? constants.SET_APPOINTMENT_IN
              : constants.SET_APPOINTMENT_OUT
          }`,
          details: `Appointment (${appointment.id}) set ${status}`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization")?.split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          status: "success",
          module: "Appointment Management",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "appointmentUpdated",
          ...(status === "in"
            ? { appointment, hospitalId: req.user.hospitalId }
            : {}),
        },
        appointment.doctorId || appointment.subDoctorId
      );

      return res.status(200).json({
        message: `Appointment status updated to ${status}.`,
        appointment,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to update appointment status",
      });
    }
  },

  async getFirstAppointment(req, res) {
    try {
      const { doctorId, doctorType } = req.query;

      let appointment;
      const whereClause = {
        date: moment().tz("Asia/Kolkata").format("YYYY-MM-DD"),
        status: {
          [Op.or]:
            req.user.role === "doctor" || req.user.role === "subDoctor"
              ? ["in"]
              : ["in", null],
        },
      };

      const roles = ["doctor", "subDoctor"];

      if (req.user.role === "receptionist" && roles.includes(doctorType)) {
        whereClause[doctorType === "doctor" ? "doctorId" : "subDoctorId"] =
          doctorId;
      } else if (roles.includes(req.user.role)) {
        whereClause[req.user.role === "doctor" ? "doctorId" : "subDoctorId"] =
          req.user.id;
      }

      appointment = await Appointment.findOne({
        where: whereClause,
        include: [
          {
            model: Patient,
            as: "patient",
            where: {
              doctorId: req.user.hospitalId,
            },
          },
        ],
        order: [
          ["status", "DESC"],
          ["createdAt", "ASC"],
        ],
      });

      return res.status(200).json({
        firstAppointment: appointment
          ? {
              ...appointment.toJSON(),
              document: getDecryptedDocumentAsBase64(appointment.document),
            }
          : null,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to retrieve appointments",
      });
    }
  },

  async cancelAppointment(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const appointmentId = req.params.appointmentId;
      const appointment = await Appointment.findOne({
        where: {
          id: appointmentId,
        },
        attributes: ["id", "status", "doctorId", "subDoctorId"],
        include: [
          {
            model: Patient,
            as: "patient",
          },
        ],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found." });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status !== null) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't cancel already proceed appointment" });
      }

      appointment.status = "cancel";

      appointment.save({ transaction });

      await AuditLog.create(
        {
          action: constants.CANCEL_APPOINTMENT,
          details: `Appointment (${appointmentId}) cancel`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          status: "success",
          newValue: {
            status: "cancel",
          },
          module: "Appointment Management",
          endpoint: req.url,
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      const appointmentDate = moment
        .tz(appointment.date, "Asia/Kolkata")
        .startOf("day");
      const todayIST = moment.tz("Asia/Kolkata").startOf("day");

      if (appointmentDate.isSame(todayIST, "day")) {
        update(
          {
            event: "cancelAppointment",
            appointment: {
              ...appointment.toJSON(),
              patient: appointment.patient,
            },
          },
          appointment.doctorId || appointment.subDoctorId
        );
      }

      res.status(200).json({ message: "Appointment cancel successfully." });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return res.status(500).json({
        error: "Failed to cancel appointment",
      });
    }
  },

  async reScheduleAppointment(req, res) {
    const { date, process, appointmentTime } = req.body;
    const transaction = await sequelize.transaction();
    try {
      const appointmentId = req.params.appointmentId;
      const appointment = await Appointment.findOne({
        where: {
          id: appointmentId,
        },
        attributes: [
          "id",
          "status",
          "process",
          "date",
          "appointmentTime",
          "patientId",
          "doctorId",
          "subDoctorId",
        ],
        include: [
          {
            model: Patient,
            as: "patient",
          },
        ],
        transaction,
      });

      if (!appointment) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ error: "Appointment not found." });
      }

      const { available, reason, slot, appointmentCount } =
        await checkDoctorAvailability(
          appointment.doctorId,
          appointment.subDoctorId,
          new Date(date),
          appointmentTime
        );

      if (!available) {
        return res.status(400).json({ error: reason });
      }

      if (req.user.role === "doctor" && appointment.doctorId !== req.user.id) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (
        req.user.role === "subDoctor" &&
        appointment.subDoctorId !== req.user.id
      ) {
        if (transaction) await transaction.rollback();
        return res.status(403).json({
          error: "You are not authorized to make changes to this appointment",
        });
      }

      if (appointment.status !== null) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't re-schedule already proceed appointment." });
      }

      const appointmentDate = moment.tz(date, "Asia/Kolkata").startOf("day");
      const todayIST = moment.tz("Asia/Kolkata").startOf("day");

      if (appointmentDate.isBefore(todayIST)) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Appointment date cannot be in the past" });
      }
      const extAppointmentDate = moment
        .tz(appointment.date, "Asia/Kolkata")
        .startOf("day");
      if (appointmentDate.isSame(extAppointmentDate)) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Can't reschedule for same day." });
      }

      const startOfDay = appointmentDate.clone().startOf("day").toDate();
      const endOfDay = appointmentDate.clone().endOf("day").toDate();

      const existingAppointment = await Appointment.findOne({
        where: {
          patientId: appointment.patientId,
          date: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
        transaction,
      });

      if (existingAppointment) {
        if (transaction) await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Patient already has an appointment on this date" });
      }

      const oldValue = {
        date: appointment.date,
        process: appointment.process,
        appointmentTime: appointment.appointmentTime,
        appointmentNumber: appointment.appointmentNumber,
      };

      appointment.date = date;
      appointment.process = process;
      appointment.appointmentTime = appointmentTime;
      appointment.appointmentNumber = appointmentCount + 1;
      await appointment.save({ transaction });

      await AuditLog.create(
        {
          action: constants.RESCHEDULE_APPOINTMENT,
          details: `Appointment (${appointmentId}) rescheduled.`,
          hospitalId: req.user.hospitalId,
          receptionistId: req.user.role === "receptionist" ? req.user.id : null,
          doctorId: req.user.role === "doctor" ? req.user.id : null,
          subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
          role: req.user.role,
          token: req.header("Authorization").split(" ")[1],
          entity: "Appointment",
          entityId: appointment.id,
          status: "success",
          module: "Appointment Management",
          endpoint: req.url,
          oldValue,
          newValue: { date, process, appointmentTime },
          ipAddress: req.clientIp,
          userAgent: req.headers["user-agent"],
        },
        {
          transaction,
        }
      );

      await transaction.commit();

      update(
        {
          event: "rescheduleAppointment",
          appointment: {
            ...appointment.toJSON(),
            patient: appointment.patient,
          },
        },
        appointment.doctorId || appointment.subDoctorId
      );

      res
        .status(200)
        .json({ message: "Appointment re-schedule successfully." });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.log(error);
      return res.status(500).json({
        error: "Failed to re-schedule appointment",
      });
    }
  },
};

module.exports = patientController;
