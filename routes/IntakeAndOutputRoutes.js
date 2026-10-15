const express = require("express");
const router = express.Router();
const intakeAndOutputController = require("../controllers/intakeAndOutput.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["receptionist", "doctor", "subDoctor","nurse"]);

router.post(
  "/add-intakeOutput",
  allowIpdRoles,
  intakeAndOutputController.addIntakeAndOutput
);

router.get(
  "/getLatest",
  allowIpdRoles,
  intakeAndOutputController.getLatestIntakeAndOutput
);

router.get(
  "/getIntakeOutput",
  allowIpdRoles,
  intakeAndOutputController.getIntakeAndOutputData
);

router.delete(
  "/:id",
  allowIpdRoles,
  intakeAndOutputController.deleteIntakeAndOutput
);

module.exports = router;