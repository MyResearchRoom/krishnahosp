const express = require("express");
const router = express.Router();
const carePlanController = require("../controllers/icuCarePlan.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["doctor", "subDoctor","receptionist","nurse"]);

router.post(
  "/add-carePlan",
  authenticate(["doctor", "subDoctor","receptionist"]),
  carePlanController.addICUCarePlan
);

router.get(
  "/getLatestCarePlans",
  allowIpdRoles,
  carePlanController.getLatestICUCarePlan
);

router.get(
  "/getPatientCarePlans/:patientId/:icuAdmissionId",
  allowIpdRoles,
  carePlanController.getICUCarePlans
);

router.patch(
  "/changeStatus/:carePlanId",
  allowIpdRoles,
  carePlanController.updateICUCarePlanStatus
);


module.exports = router;

// Jayashri@Github
// jayashribharambe-29