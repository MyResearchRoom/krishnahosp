const express = require("express");
const router = express.Router();

const ipdController = require("../controllers/ipdController.js");
const { authenticate } = require("../middlewares/authentication.js");

const allowIpdRoles = authenticate(["receptionist", "doctor", "subDoctor"]);

router.post("/admissions", allowIpdRoles, ipdController.createAdmission);
router.get("/admissions", allowIpdRoles, ipdController.getAdmissions);
router.get("/admissions/:id/billing-summary", allowIpdRoles, ipdController.getAdmissionBillingSummary);
router.get("/admissions/:id", allowIpdRoles, ipdController.getAdmissionById);

router.get("/transfers/options", allowIpdRoles, ipdController.getTransferOptions);
router.get("/transfers/recent", allowIpdRoles, ipdController.getRecentTransfers);
router.post("/transfers", allowIpdRoles, ipdController.transferBed);

router.post("/discharges", allowIpdRoles, ipdController.createDischarge);
router.get("/discharges", allowIpdRoles, ipdController.getDischarges);

router.post("/accounts/invoices", allowIpdRoles, ipdController.createInvoice);
router.get("/accounts/invoices", allowIpdRoles, ipdController.getInvoices);
router.get("/accounts/stats", allowIpdRoles, ipdController.getInvoiceStats);
router.get("/accounts/invoices/:invoiceNo", allowIpdRoles, ipdController.getInvoiceByNumber);
router.put("/accounts/invoices/:invoiceNo", allowIpdRoles, ipdController.updateInvoice);
router.patch(
  "/accounts/invoices/:invoiceNo/payment",
  allowIpdRoles,
  ipdController.recordInvoicePayment
);

module.exports = router;
