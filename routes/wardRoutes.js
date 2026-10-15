const express = require("express");
const router = express.Router();

const wardController = require("../controllers/wardController.js");
const { authenticate } = require("../middlewares/authentication.js");

router.post(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  wardController.createWard
);

router.get(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  wardController.getWards
);

router.get(
  "/stats",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  wardController.getWardStats
);

router.put(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  wardController.updateWard
);

router.delete(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  wardController.deleteWard
);

module.exports = router;
