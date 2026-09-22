const express = require("express");
const router = express.Router();

const roomController = require("../controllers/roomController.js");
const { authenticate } = require("../middlewares/authentication.js");

router.post(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  roomController.createRoom
);

router.get(
  "/",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  roomController.getRooms
);

router.get(
  "/stats",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  roomController.getRoomStats
);

router.put(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  roomController.updateRoom
);

router.delete(
  "/:id",
  authenticate(["receptionist", "doctor", "subDoctor"]),
  roomController.deleteRoom
);

module.exports = router;
