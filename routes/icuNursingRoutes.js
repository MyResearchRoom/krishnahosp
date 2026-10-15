const express = require("express");
const router = express.Router();
const noteController = require("../controllers/icuNurseNotes.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["doctor", "subDoctor","receptionist","nurse"]);

router.post(
  "/add-note",
  authenticate(["nurse"]),
  noteController.addICUNursingNote
);

router.get(
  "/getLatestNursingNote",
  allowIpdRoles,
  noteController.getLatestICUNursingNote
);

router.get(
  "/getNursingNotes",
  allowIpdRoles,
  noteController.getICUNursingNotes
);



module.exports = router;