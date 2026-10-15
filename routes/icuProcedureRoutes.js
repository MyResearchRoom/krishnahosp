const express = require("express");
const router = express.Router();
const proceduresController = require("../controllers/icuProcedure.js");
const { authenticate } = require("../middlewares/authentication.js");
const allowIpdRoles = authenticate(["doctor", "subDoctor","receptionist"]);

router.post(
  "/add-Procedure",
  allowIpdRoles,
  proceduresController.addProcedure
);

router.get(
  "/getProcedures",
  allowIpdRoles,
  proceduresController.getProcedureData
);

router.get(
  "/proceduresById/:procedureId",
  allowIpdRoles,
  proceduresController.getProcedureDataById
);

module.exports = router;