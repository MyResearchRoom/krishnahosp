const express = require("express");
const router = express.Router();

const patientController = require("../controllers/patientController.js");

const {
  patientRegistrationValidationRule,
  validate,
  patientAppointmentValidationRule,
} = require("../middlewares/validations.js");
const { authenticate } = require("../middlewares/authentication");

router.post(
  "/register",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientRegistrationValidationRule,
  validate,
  patientController.addPatient
);

router.post(
  "/appointment/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientAppointmentValidationRule,
  validate,
  patientController.bookAppointment
);

router.get(
  "/patients",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientController.getPatients
);

router.get(
  "/patients-for-appointment",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientController.getPatientsForAppointment
);

router.put(
  "/update-toxicity/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientController.setToxicity
);

router.get(
  "/getCounts",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientController.getPatientsCount
);
router.get(
  "/count/all-time",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  patientController.getAllTimePatientCount
);

router.get(
  "/getPatientById/:id", 
  patientController.getPatientById
);

module.exports = router;
