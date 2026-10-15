"use strict";

const express = require("express");
const router = express.Router();

const operatingTheatreController = require("../controllers/operatingTheatreController");
const { authenticate } = require("../middlewares/authentication");

router.post(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.createOperatingTheatre
);

router.get(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.getOperatingTheatres
);

router.get(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.getOperatingTheatreById
);

router.patch(
  "/toggle-block/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.toggleOperatingTheatreBlock
);

router.patch(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.updateOperatingTheatre
);

module.exports = router;
