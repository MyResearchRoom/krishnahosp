const express = require("express");
const {
  getNotifications,
  markAsRead,
  deleteNotification,
  getNotificationsCount,
} = require("../controllers/notificationController");
const { authenticate } = require("../middlewares/authentication");
const router = express.Router();

router.get("/", authenticate(["doctor"]), getNotifications);
router.patch("/:id/read", authenticate(["doctor"]), markAsRead);
router.delete("/:id", authenticate(["doctor"]), deleteNotification);
router.get("/count", authenticate(["doctor"]), getNotificationsCount);

module.exports = router;
