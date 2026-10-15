const express = require("express");
const router = express.Router();
const controller = require("../controllers/doctorTimeSlotController");
const { authenticate } = require("../middlewares/authentication");

router.post("/", authenticate(["doctor"]), controller.createSlot);
router.get("/", authenticate(["doctor"]), controller.getSlots);
router.put("/:id", authenticate(["doctor"]), controller.updateSlot);
router.delete("/:id", authenticate(["doctor"]), controller.deleteSlot);
router.get("/subdoctor-slots", authenticate([]), controller.getSubDoctorSlots);

module.exports = router;
