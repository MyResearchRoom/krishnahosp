const express = require("express");
const router = express.Router();

const {
  validate,
  receptionistRegistrationValidationRules,
} = require("../middlewares/validations.js");

const receptionistController = require("../controllers/receptionistController");
const { upload } = require("../middlewares/upload");
const { authenticate } = require("../middlewares/authentication.js");

router.post(
  "/register",
  upload.fields([{ name: "profile" }, { name: "documents" }, { name: "documents[]" }]),
  receptionistRegistrationValidationRules,
  validate,
  authenticate([]),
  receptionistController.addReceptionist
);

router.put(
  "/:id",
  upload.fields([{ name: "profile" }, { name: "documents" }, { name: "documents[]" }]),
  authenticate([]),
  receptionistController.editReceptionist
);

router.patch(
  "/:id",
  upload.fields([{ name: "profile" }, { name: "documents" }, { name: "documents[]" }]),
  authenticate([]),
  receptionistController.editReceptionist
);

router.delete(
  "/:id",
  authenticate([]),
  receptionistController.removeReceptionist
);

router.delete(
  "/:receptionistId/documents/:documentId",
  authenticate([]),
  receptionistController.deleteReceptionistDocument
);

router.get("/", authenticate([]), receptionistController.getAllReceptionists);

router.get("/me", authenticate([]), receptionistController.getMe);

router.post(
  "/change-profile",
  authenticate([]),
  upload.single("profile"),
  receptionistController.changeProfile
);

router.post(
  "/change-password/:id",
  authenticate([]),
  receptionistController.changePassword
);

router.get(
  "/:id",
  authenticate([]),
  receptionistController.getReceptionistById
);

router.post(
  "/check-in",
  authenticate(["receptionist"]),
  receptionistController.checkIn
);

router.post(
  "/check-out",
  authenticate(["receptionist"]),
  receptionistController.checkOut
);

router.get(
  "/stats/:id",
  authenticate([]),
  receptionistController.getReceptionistAttendanceStats
);

router.get(
  "/attendance/history",
  authenticate([]),
  receptionistController.getAttendanceHistoryByMonth
);

router.get(
  "/attendance-history/:id",
  authenticate([]),
  receptionistController.getAttendanceHistoryByMonth
);

module.exports = router;
