const cron = require("node-cron");
const moment = require("moment-timezone");
const { Appointment, Patient } = require("../models");
const { decrypt } = require("../utils/cryptography");
const {
  sendAppointmentReminderEmail,
} = require("../services/appointmentReminderService");

const REMINDER_HOURS_BEFORE = 2;
const CRON_INTERVAL_MINUTES = 10; 
const TIMEZONE = "Asia/Kolkata";

const parseSlotStartTime = (appointmentTime) => {
  if (!appointmentTime || typeof appointmentTime !== "string") return null;
  const start = appointmentTime.split("-")[0]?.trim();
  return start || null;
};

const runReminderCheck = async () => {
  try {
    const now = moment().tz(TIMEZONE);
    const windowStart = now.clone().add(REMINDER_HOURS_BEFORE, "hours");
    const windowEnd = windowStart.clone().add(CRON_INTERVAL_MINUTES, "minutes");

    const todayStr = now.format("YYYY-MM-DD");
    const tomorrowStr = now.clone().add(1, "day").format("YYYY-MM-DD");

    const appointments = await Appointment.findAll({
      where: {
        date: [todayStr, tomorrowStr],
        reminderSent: false,
      },
      include: [{ model: Patient, as: "patient" }],
    });

    for (const appointment of appointments) {
      const startTime = parseSlotStartTime(appointment.appointmentTime);
      if (!startTime) continue;

      const dateStr = moment(appointment.date).format("YYYY-MM-DD");
      const appointmentDateTime = moment.tz(
        `${dateStr} ${startTime}`,
        ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm"],
        TIMEZONE
      );

      if (!appointmentDateTime.isValid()) continue;

      const isDue =
        appointmentDateTime.isSameOrAfter(windowStart) &&
        appointmentDateTime.isBefore(windowEnd);

      if (!isDue) continue;

      const patient = appointment.patient;
      if (!patient) continue;

      await sendAppointmentReminderEmail({
        toEmail: patient.email ? decrypt(patient.email) : null,
        patientName: patient.name ? decrypt(patient.name) : patient.name,
        date: appointment.date,
        appointmentTime: appointment.appointmentTime,
        reason: appointment.reason ? decrypt(appointment.reason) : appointment.reason,
      });

      appointment.reminderSent = true;
      await appointment.save();
    }
  } catch (error) {
    console.error(
      "[appointmentReminderJob] Reminder check failed:",
      error.message
    );
  }
};

const startAppointmentReminderJob = () => {
  
  cron.schedule(`*/${CRON_INTERVAL_MINUTES} * * * *`, runReminderCheck);
  console.log(
    `[appointmentReminderJob] Scheduled — checking every ${CRON_INTERVAL_MINUTES} min for appointments ${REMINDER_HOURS_BEFORE}h away.`
  );
};

module.exports = { startAppointmentReminderJob, runReminderCheck };
