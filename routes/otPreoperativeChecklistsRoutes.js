"use strict";

const express = require("express");
const router = express.Router();

const otPreoperativeChecklistsController = require("../controllers/otPreoperativeChecklistsController");
const { authenticate } = require("../middlewares/authentication");

router.get(
  "/getData",
  authenticate(["receptionist", "doctor", "subDoctor","nurse"]),
  otPreoperativeChecklistsController.getScheduledOTPreoperativeChecklists
);

router.post(
  "/:checklistId/items",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otPreoperativeChecklistsController.addOTPreoperativeChecklistItems
);

router.get(
  "/checklists/:patientId/:checklistId/items",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otPreoperativeChecklistsController.getOTPreoperativeChecklistItemsByPatientAndChecklist
);

router.post(
  "/complete/:checklistId",
  authenticate(["receptionist", "doctor", "subDoctor", "nurse"]),
  otPreoperativeChecklistsController.completeOTPreoperativeChecklist
);


router.patch(
  "/:checklistId/in-progress",
  authenticate(["doctor", "subDoctor",]),
  otPreoperativeChecklistsController.markOTPreoperativeChecklistInProgress
);



module.exports = router;
