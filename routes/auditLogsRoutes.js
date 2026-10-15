const express = require("express");
const {
  getAuditLogs,
  getLoginAuditLogs,
  deleteAuditLog,
} = require("../controllers/auditLogsController");

const { authenticate } = require("../middlewares/authentication");

const router = express.Router();

router.get("/", authenticate(["doctor"]), getAuditLogs);

router.get("/login/logs", authenticate(["doctor"]), getLoginAuditLogs);

router.get("/:id", authenticate(["doctor"]), deleteAuditLog);

module.exports = router;
