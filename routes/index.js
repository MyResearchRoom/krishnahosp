const express = require("express");
const router = express.Router();

const doctorRouter = require("./doctorRoutes.js");
const receptionistRoutes = require("./receptionistRoutes.js");
const patientRoutes = require("./patientRoutes.js");
const medicineRoutes = require("./medicineRoutes.js");
const appointmentRoutes = require("./appointmentRoutes.js");
const notificationRoutes = require("./notificationRoutes.js");
const auditLogsRoutes = require("./auditLogsRoutes.js");
const subDoctorRoutes = require("./subDoctorRoutes.js");
const doctorTimeSlotRoutes = require("./doctorTimeSlotRoutes.js");
const financeRoutes = require("./financeRoutes.js");
const wardRoutes = require("./wardRoutes.js");
const roomRoutes = require("./roomRoutes.js");
const bedRoutes = require("./bedRoutes.js");
const ipdRoutes = require("./ipdRoutes.js");
const ipdClinicalSummaryRoutes = require("./ipdClinicalSummaryRoutes.js");

router.use("/test", (req, res) =>
  res.send(`<h1>This is a test API_03102025: ${req.clientIp}</h1>`)
);
router.use("/api/doctors", doctorRouter);
router.use("/api/receptionists", receptionistRoutes);
router.use("/api/patients", patientRoutes);
router.use("/api/medicines", medicineRoutes);
router.use("/api/appointments", appointmentRoutes);
router.use("/api/notifications", notificationRoutes);
router.use("/api/audit-logs", auditLogsRoutes);
router.use("/api/subdoctors", subDoctorRoutes);
router.use("/api/doctor_time_slots", doctorTimeSlotRoutes);
router.use("/api/doctorTimeSlots", doctorTimeSlotRoutes);
router.use("/api/finance", financeRoutes);
router.use("/api/ipd/wards", wardRoutes);
router.use("/api/ipd/rooms", roomRoutes);
router.use("/api/ipd/beds", bedRoutes);
router.use("/api/ipd", ipdRoutes);
router.use("/api/ipd", ipdClinicalSummaryRoutes);

module.exports = router;
