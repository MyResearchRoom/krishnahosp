const express = require("express");

const router = express.Router();

const { authenticate } = require("../middlewares/authentication.js");

const clinicalSummaryController = require("../controllers/ipdClinicalSummaryController");

router.get(
  "/admissions/:admissionId/clinical-summary",
  authenticate(["doctor", "subDoctor"]),
  clinicalSummaryController.getSections
);

router.post(
  "/admissions/:admissionId/clinical-summary",
  authenticate(["doctor", "subDoctor"]),
  clinicalSummaryController.createSection
);

router.put(
  "/clinical-summary/:id",
  authenticate(["doctor", "subDoctor"]),
  clinicalSummaryController.updateSection
);

router.delete(
  "/clinical-summary/:id",
  authenticate(["doctor", "subDoctor"]),
  clinicalSummaryController.deleteSection
);

router.get( 
  "/doctors",
  authenticate(["doctor"]),
  clinicalSummaryController.getDoctors
);

module.exports = router;    