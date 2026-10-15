const express = require("express");
const router = express.Router();
const medicationController = require("../controllers/icuMedications.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["doctor", "subDoctor",,"receptionist","nurse"]);

router.post(
  "/add-medication",
  authenticate(["doctor", "subDoctor"]),
  medicationController.addICUMedication
);

router.get(
  "/getLatestMedications",
  allowIpdRoles,
  medicationController.getLatestICUMedications
);

router.get(
  "/getPatientMedications/:patientId/:icuAdmissionId",
  allowIpdRoles,
  medicationController.getICUMedications
);




module.exports = router;