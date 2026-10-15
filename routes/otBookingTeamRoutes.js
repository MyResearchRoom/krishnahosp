"use strict";

const express = require("express");
const router = express.Router();

const otBookingTeamController = require("../controllers/otBookingTeamController");
const { authenticate } = require("../middlewares/authentication");

router.post(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otBookingTeamController.addOTBookingTeam
);

router.get(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otBookingTeamController.getOTBookingTeam
);

module.exports = router;
