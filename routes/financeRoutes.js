const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const { authenticate } = require("../middlewares/authentication");

router.use(authenticate(["doctor"]));

router.get("/overview", financeController.getFinanceOverview);
router.get("/plans", financeController.getPlans);
router.get("/plans/history", financeController.getPlanHistory);
router.get("/plans/:planVersionId", financeController.getPlanById);
router.patch("/change-plan", financeController.changePlan);
router.patch("/extend-plan", financeController.extendPlan);

module.exports = router;
