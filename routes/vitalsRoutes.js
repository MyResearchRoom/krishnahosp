const express = require("express");
const router = express.Router();
const vitalsController = require("../controllers/vitalsController.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["receptionist", "doctor", "subDoctor","nurse"]);

router.post(
  "/add-vitals",
  allowIpdRoles,
  vitalsController.addVitals
);

router.get(
  "/getLatestVitals",
  allowIpdRoles,
  vitalsController.getLatestVitals
);


router.get(
  "/getvitals",
  allowIpdRoles,
  vitalsController.getVitals
);

router.delete(
  "/:vitalId",
  allowIpdRoles,
  vitalsController.deleteVitals
);

module.exports = router;