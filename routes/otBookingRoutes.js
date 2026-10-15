"use strict";

const express = require("express");
const router = express.Router();

const operatingTheatreController = require("../controllers/otBookingController");

const { authenticate } = require("../middlewares/authentication");

router.post(
  "/request-ot",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  operatingTheatreController.requestOTBooking
);

router.get(
  "/requests",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  operatingTheatreController.getOTBookings
);


router.get(
  "/requests/:id",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  operatingTheatreController.getOTBookingDetails
);

router.delete(
  "/requests/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.deleteOTBookingRequest
);

router.patch(
  "/decision/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  operatingTheatreController.decideOTBookingRequest
);

router.patch(
  "/schedule/:id",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  operatingTheatreController.scheduleOTBooking
);

router.patch(
  "/start/:id",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  operatingTheatreController.startOTBooking
);

module.exports = router;
