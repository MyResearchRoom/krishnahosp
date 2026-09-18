const express = require("express");
const router = express.Router();

const ipdAccount = require("../controllers/accountController.js");
const { authenticate } = require("../middlewares/authentication.js");

const allowIpdRoles = authenticate(["receptionist", "doctor", "subDoctor"]);

router.get(
    "/getAccounts", 
    allowIpdRoles, 
    ipdAccount.getAccounts
);

router.get(
    "/getAccount/:id", 
    allowIpdRoles, 
    ipdAccount.getAccountById
);

router.get(
  "/getCharges/:accountId/",
  allowIpdRoles,
  ipdAccount.getAccountCharges
);


router.get(
  "/admitted-patients",
  allowIpdRoles,
  ipdAccount.getAdmittedPatientsForAccount
);

router.post(
  "/add-charges/:accountId",
  allowIpdRoles,
  ipdAccount.addAccountCharges
);

router.get(
  "/getPayments",
  allowIpdRoles,
  ipdAccount.getPayments
);

router.get(
  "/getPayments/:accountId/:patientId/:paymentId",
  allowIpdRoles,
  ipdAccount.getPaymentsByAccountAndPatient
);

router.post(
  "/add-payment/:accountId",
  allowIpdRoles,
  ipdAccount.addAccountPayment
);

router.patch(
  "/edit-payment/:accountId/:paymentId",
  allowIpdRoles,
  ipdAccount.updateAccountPaymentByPaymentId
);

router.get(
  "/payments/admission/:admissionId",
  allowIpdRoles,
  ipdAccount.getPaymentsByAdmissionId
);

module.exports = router;