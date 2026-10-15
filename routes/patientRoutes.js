const express = require("express");
const router = express.Router();

const patientController = require("../controllers/patientController.js");

const {
  patientRegistrationValidationRule,
  validate,
  patientAppointmentValidationRule,
} = require("../middlewares/validations.js");
const { authenticate } = require("../middlewares/authentication");
const { upload } = require("../middlewares/upload.js");

const allowIpdRoles = authenticate(["receptionist", "doctor", "subDoctor","nurse"]);

router.post(
  "/register",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientRegistrationValidationRule,
  validate,
  patientController.addPatient
);

router.post(
  "/appointment/:id",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientAppointmentValidationRule,
  validate,
  patientController.bookAppointment
);

router.get(
  "/patients",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientController.getPatients
);

router.get(
  "/patients-for-appointment",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientController.getPatientsForAppointment
);

router.put(
  "/update-toxicity/:id",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientController.setToxicity
);

router.get(
  "/getCounts",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientController.getPatientsCount
);
router.get(
  "/count/all-time",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientController.getAllTimePatientCount
);

router.get(
  "/getPatientById/:id", 
  patientController.getPatientById
);

router.post(
  "/addDocuments/:patientId/:admissionId",
  allowIpdRoles,
  upload.single("document"),
  patientController.addPatientDocument
);

router.get(
  "/documents/:patientId/:admissionId",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  patientController.getPatientDocuments
);

router.delete(
  "/:documentId",
  allowIpdRoles,
  patientController.deletePatientDocument
);

router.post(
  "/birth-certificates",
  allowIpdRoles,
  patientController.addBirthCertificate
);

router.patch(
  "/birth-certificates/:certificateId",
  allowIpdRoles,
  patientController.updateBirthCertificate
);

router.get(
  "/birth-certificates/:motherPatientId",
  allowIpdRoles,
  patientController.getBirthCertificate
);


module.exports = router;
