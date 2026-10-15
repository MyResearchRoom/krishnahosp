"use strict";

const express = require("express");
const router = express.Router();

const otIntraoperativeController = require("../controllers/otIntraoperativeController");
const { authenticate } = require("../middlewares/authentication");

router.delete(
  "/note/:noteId",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otIntraoperativeController.deleteOTIntraoperativeNoteById
);

router.get(
  "/:bookingId",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otIntraoperativeController.getOTIntraoperativeNotesByBookingId
);

router.post(
  "/:bookingId",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otIntraoperativeController.addOTIntraoperativeNote
);

module.exports = router;
