const express = require("express");
const router = express.Router();
const noteController = require("../controllers/icuDoctorNotes.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["doctor", "subDoctor"]);

router.post(
  "/add-note",
  allowIpdRoles,
  noteController.addICUDoctorNote
);

router.get(
  "/getLatestDoctorNotes",
  allowIpdRoles,
  noteController.getLatestICUDoctorNote
);

router.get(
  "/getDoctorNotes",
  allowIpdRoles,
  noteController.getICUDoctorNotes
);

router.delete(
  "/:noteId",
  allowIpdRoles,
  noteController.deleteNote
);

module.exports = router;