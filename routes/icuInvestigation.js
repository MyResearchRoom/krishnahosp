const express = require("express");
const router = express.Router();
const investigationsController = require("../controllers/icuInvestigations.js");
const { authenticate } = require("../middlewares/authentication.js");
const { upload } = require("../middlewares/upload.js");
const allowIpdRoles = authenticate(["doctor", "subDoctor","receptionist"]);

router.post(
  "/add-investigation",
  allowIpdRoles,
  upload.single("document"),
  investigationsController.addInvestigation
);

router.get(
  "/getInvestigations",
  allowIpdRoles,
  investigationsController.getInvestigationData
);


module.exports = router;