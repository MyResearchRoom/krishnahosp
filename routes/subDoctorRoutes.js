const express = require("express");
const router = express.Router();
const subDoctorController = require("../controllers/subDoctorController");
const {
  createSubDoctorValidationRules,
  validate,
} = require("../middlewares/validations");
const { authenticate } = require("../middlewares/authentication");
const { upload } = require("../middlewares/upload");

router.post(
  "/",
  upload.fields([
    { name: "profile", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
  ]),
  authenticate(["doctor"]),
  createSubDoctorValidationRules,
  validate,
  subDoctorController.createSubDoctor
);

router.get("/", authenticate(["doctor"]), subDoctorController.getAllSubDoctors);

router.get("/stats", authenticate(["doctor"]), subDoctorController.stats);

router.get(
  "/departemntWiseSubdoctor", 
  authenticate(["receptionist", "doctor", "subDoctor"]),
  subDoctorController.getPrescriptionSubDoctors);
  
router.get(
  "/:id",
 authenticate(["doctor", "subDoctor"]),
  subDoctorController.getSubDoctorById
);

router.put(
  "/:id",
  upload.fields([
    { name: "profile", maxCount: 1 },
    { name: "idProof", maxCount: 1 },
  ]),
  authenticate(["doctor"]),
  createSubDoctorValidationRules,
  validate,
  subDoctorController.updateSubDoctor
);

router.delete(
  "/:id",
  authenticate(["doctor"]),
  subDoctorController.deleteSubDoctor
);

router.patch(
  "/togglePrescriptionDisplay",
  authenticate(["doctor"]),
  subDoctorController.togglePrescriptionDisplay
);

router.patch(
  "/:id/toggle-status",
  authenticate(["doctor"]),
  subDoctorController.toggleSubDoctorStatus
);

router.post(
  "/add-signature",
  upload.single("signature"),
  authenticate(["subDoctor"]),
  subDoctorController.addSignature
);



module.exports = router;
