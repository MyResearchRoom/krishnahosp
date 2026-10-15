const express = require("express");
const router = express.Router();
const icuAdmissionController = require("../controllers/ICUAdmission.js");
const { authenticate } = require("../middlewares/authentication.js");
const { upload } = require("../middlewares/upload.js");

const allowIpdRoles = authenticate(["receptionist", "doctor", "subDoctor"]);

router.post(
  "/create-admissions", 
  allowIpdRoles, 
  icuAdmissionController.transferIPDToICU
);

router.post(
  "/tranferICUadmissionsTOIPD", 
  allowIpdRoles, 
  icuAdmissionController.transferICUToIPD
);

router.post(
  "/admit", 
  allowIpdRoles, 
  upload.array("documents", 5),
  icuAdmissionController.createAdmission
);


router.get(
  "/getAdmissions", 
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  icuAdmissionController.getICUAdmissions
);

router.post(
  "/discharges", 
  allowIpdRoles, 
  icuAdmissionController.initiateICUDischarge
);

router.patch(
  "/complete-discharge/:dischargeId",
  allowIpdRoles,
  icuAdmissionController.completeDischarge
)

router.get(
  "/admissions/patient/:patientId",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  icuAdmissionController.getICUAdmissionByPatientId
);
module.exports = router;