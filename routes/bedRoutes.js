const express = require("express");
const router = express.Router();

const bedController = require("../controllers/bedController.js");
const { authenticate } = require("../middlewares/authentication.js");

router.post(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.createBed
);

router.get(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.getBeds
);

router.get(
  "/stats",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.getBedStats
);

router.get(
  "/hierarchy",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.getBedHierarchy
);

router.get(
  "/occupied-patients",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.getOccupiedBedPatients
);

router.put(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.updateBed
);

router.delete(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  bedController.deleteBed
);

module.exports = router;
