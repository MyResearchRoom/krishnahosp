const moment = require("moment-timezone");
const { Op } = require("sequelize");
const {
  Appointment,
  Doctor,
  HospitalPlan,
  Patient,
  Plan,
  PlanVersion,
  Receptionist,
  Sequelize,
  SubDoctor,
  sequelize,
} = require("../models");

const parseBillingCycles = (cycles) => {
  if (Array.isArray(cycles)) return cycles;
  if (typeof cycles !== "string") return [];
  try {
    return JSON.parse(cycles);
  } catch {
    return [];
  }
};

const addMonths = (date, months) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

const getBillingMeta = (planVersion, billingCycle) => {
  const cycles = parseBillingCycles(planVersion.plan?.billingCycle);
  const selected = cycles.find((cycle) => cycle.billingCycle === billingCycle);
  const monthsToAdd = Number(selected?.month || 1);
  const discountPercent = Number(selected?.discount || 0);
  const baseAmount = Number(planVersion.baseMonthlyPrice || 0) * monthsToAdd;
  const amountPaid = baseAmount - (baseAmount * discountPercent) / 100;

  return { monthsToAdd, discountPercent, baseAmount, amountPaid };
};

const getPlanInclude = () => [
  {
    model: PlanVersion,
    as: "planVersion",
    include: [{ model: Plan, as: "plan" }],
  },
];

const getCurrentPlan = (hospitalId, transaction) =>
  HospitalPlan.findOne({
    where: {
      hospitalId,
      status: { [Op.in]: ["active", "expiringSoon", "suspended", "expired"] },
    },
    include: getPlanInclude(),
    order: [
      [
        Sequelize.literal(`
          CASE
            WHEN status = 'active' THEN 1
            WHEN status = 'expiringSoon' THEN 2
            WHEN status = 'suspended' THEN 3
            WHEN status = 'expired' THEN 4
            ELSE 5
          END
        `),
        "ASC",
      ],
      ["startDate", "DESC"],
      ["planExpiryDate", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });

const getUsage = async (hospitalId, startDate, planExpiryDate) => {
  const dateFilter =
  startDate
    ? {
        createdAt: {
          [Op.gte]: moment(startDate).tz("Asia/Kolkata").toDate(),
        },
      }
    : {};

  const [
    doctorUsedLimit,
    patientUsedLimit,
    staffUsedLimit,
    appointmentUsedLimit,
  ] = await Promise.all([
    SubDoctor.count({
      where: {
        addedBy: hospitalId,
        ...dateFilter,
      },
    }),
    Patient.count({
      where: {
        doctorId: hospitalId,
        ...dateFilter,
      },
    }),
    Receptionist.count({
      where: {
        doctorId: hospitalId,
        ...dateFilter,
      },
    }),
    Appointment.count({
      where: {
        doctorId: hospitalId,
        ...dateFilter,
      },
    }),
  ]);

  return { doctorUsedLimit, patientUsedLimit, staffUsedLimit, appointmentUsedLimit };
};

const toOverview = async (hospital, currentPlan) => {
  const version = currentPlan?.planVersion;
  const usage = await getUsage(
    hospital.id,
    currentPlan?.startDate,
    currentPlan?.planExpiryDate
  );
  const expiry = currentPlan?.planExpiryDate ? new Date(currentPlan.planExpiryDate) : null;
  const remainingDays = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    id: hospital.id,
    clinicName: hospital.clinicName,
    name: hospital.name,
    email: hospital.email,
    mobileNumber: hospital.mobileNumber,
    clinicAddress: hospital.clinicAddress,
    accountStatus: hospital.accountStatus,
    planId: version?.id || null,
    planName: version?.plan?.planName || "NA",
    status: currentPlan?.status || "NA",
    isActive: currentPlan?.status || "NA",
    startDate: currentPlan?.startDate
      ? new Date(currentPlan.startDate).toLocaleDateString()
      : "NA",
    planExpiryDate: expiry ? expiry.toLocaleDateString() : "NA",
    renewalDate: expiry ? expiry.toLocaleDateString() : "NA",
    remainingDays,
    baseMonthlyPrice: version?.baseMonthlyPrice || 0,
    doctorLimit: version?.doctorLimit || 1,
    patientLimit: version?.patientLimit || 1,
    staffLimit: version?.staffLimit || 1,
    dailyAppointmentLimit: version?.dailyAppointmentLimit || 1,
    ...usage,
  };
};

exports.getFinanceOverview = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const hospital = await Doctor.findByPk(hospitalId, {
      attributes: [
        "id",
        "clinicName",
        "name",
        "email",
        "mobileNumber",
        "clinicAddress",
        "accountStatus",
      ],
    });

    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    const currentPlan = await getCurrentPlan(hospitalId);
    const data = await toOverview(hospital, currentPlan);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load finance details" });
  }
};

exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.findAll({
      include: [
        {
          model: PlanVersion,
          as: "versions",
          order: [["versionNumber", "DESC"]],
          limit: 1,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: plans.map((plan) => ({
        planName: plan.planName,
        billingCycle: parseBillingCycles(plan.billingCycle),
        ...(plan.versions?.[0]?.dataValues || {}),
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch plans" });
  }
};

exports.getPlanById = async (req, res) => {
  try {
    const planVersion = await PlanVersion.findByPk(req.params.planVersionId, {
      include: [{ model: Plan, as: "plan" }],
    });

    if (!planVersion) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        planName: planVersion.plan?.planName,
        billingCycle: parseBillingCycles(planVersion.plan?.billingCycle),
        ...planVersion.dataValues,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch plan" });
  }
};

exports.getPlanHistory = async (req, res) => {
  try {
    const plans = await HospitalPlan.findAll({
      where: { hospitalId: req.user.hospitalId },
      include: getPlanInclude(),
      order: [
        [
          Sequelize.literal(`
            CASE
              WHEN status = 'active' THEN 1
              WHEN status = 'expiringSoon' THEN 2
              WHEN status = 'upcoming' THEN 3
              WHEN status = 'suspended' THEN 4
              WHEN status = 'stopped' THEN 5
              WHEN status = 'expired' THEN 6
              ELSE 7
            END
          `),
          "ASC",
        ],
        ["planExpiryDate", "DESC"],
      ],
    });

    return res.status(200).json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch billing history" });
  }
};

exports.changePlan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const hospitalId = req.user.hospitalId;
    const { planVersionId, billingCycle, billingOption } = req.body;

    if (!planVersionId || !billingCycle || !billingOption) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Please select plan, billing cycle, and change option.",
      });
    }

    const planVersion = await PlanVersion.findByPk(planVersionId, {
      include: [{ model: Plan, as: "plan" }],
      transaction,
    });

    if (!planVersion) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const { monthsToAdd, discountPercent, baseAmount, amountPaid } =
      getBillingMeta(planVersion, billingCycle);

    const hospital = await Doctor.findByPk(hospitalId, { transaction });
    if (hospital && hospital.accountStatus !== "active") {
      await hospital.update({ accountStatus: "active" }, { transaction });
    }

    if (billingOption === "nextCycle") {
      const lastPlan = await HospitalPlan.findOne({
        where: { hospitalId },
        order: [["planExpiryDate", "DESC"]],
        transaction,
      });
      const startDate = lastPlan
        ? addMonths(new Date(lastPlan.planExpiryDate), 0)
        : new Date();
      if (lastPlan) startDate.setDate(startDate.getDate() + 1);

      await HospitalPlan.create(
        {
          hospitalId,
          planVersionId,
          status: lastPlan ? "upcoming" : "active",
          startDate,
          planExpiryDate: addMonths(startDate, monthsToAdd),
          baseAmount,
          amountPaid,
          discountPercent,
          durationMonths: monthsToAdd,
        },
        { transaction }
      );

      await transaction.commit();
      return res.status(200).json({ success: true, message: "Plan scheduled successfully" });
    }

    const activePlan = await getCurrentPlan(hospitalId, transaction);
    if (activePlan) {
      await activePlan.update(
        {
          status: activePlan.status === "expired" ? "expired" : "stopped",
          planExpiryDate:
            activePlan.status === "expired" ? activePlan.planExpiryDate : new Date(),
        },
        { transaction }
      );
    }

    const startDate = new Date();
    const newPlan = await HospitalPlan.create(
      {
        hospitalId,
        planVersionId,
        status: "active",
        startDate,
        planExpiryDate: addMonths(startDate, monthsToAdd),
        baseAmount,
        amountPaid,
        discountPercent,
        durationMonths: monthsToAdd,
      },
      { transaction }
    );

    const upcomingPlans = await HospitalPlan.findAll({
      where: { hospitalId, status: "upcoming" },
      order: [["startDate", "ASC"]],
      transaction,
    });

    let lastDate = new Date(newPlan.planExpiryDate);
    for (const plan of upcomingPlans) {
      const nextStartDate = new Date(lastDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      await plan.update(
        {
          startDate: nextStartDate,
          planExpiryDate: addMonths(nextStartDate, plan.durationMonths),
        },
        { transaction }
      );
      lastDate = new Date(plan.planExpiryDate);
    }

    await transaction.commit();
    return res.status(200).json({ success: true, message: "Plan changed successfully" });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to change plan" });
  }
};

exports.extendPlan = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const hospitalId = req.user.hospitalId;
    const { billingCycle, autoRenew, planVersionId, planId } = req.body;

    if (typeof autoRenew !== "boolean" || !billingCycle) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Please select a billing cycle and auto renew option.",
      });
    }

    const currentPlan = await getCurrentPlan(hospitalId, transaction);
    if (!currentPlan?.planVersion) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "No plan found" });
    }

    let targetPlanVersion = currentPlan.planVersion;
    const targetVersionId = planVersionId || planId;
    if (targetVersionId) {
      let pv = await PlanVersion.findByPk(targetVersionId, {
        include: [{ model: Plan, as: "plan" }],
        transaction,
      });
      if (!pv) {
        pv = await PlanVersion.findOne({
          where: { planId: targetVersionId },
          include: [{ model: Plan, as: "plan" }],
          order: [["versionNumber", "DESC"]],
          transaction,
        });
      }
      if (pv) targetPlanVersion = pv;
    }

    if (targetPlanVersion && !targetPlanVersion.plan && targetPlanVersion.planId) {
      const parentPlan = await Plan.findByPk(targetPlanVersion.planId, { transaction });
      if (parentPlan) {
        targetPlanVersion.plan = parentPlan;
      }
    }

    const { monthsToAdd, discountPercent, baseAmount, amountPaid } =
      getBillingMeta(targetPlanVersion, billingCycle);

    const startDate = new Date();
    const currentExpiry = currentPlan.planExpiryDate
      ? new Date(currentPlan.planExpiryDate)
      : new Date();
    const extensionBaseDate =
      currentExpiry.getTime() > startDate.getTime() ? currentExpiry : startDate;
    const newExpiryDate = addMonths(extensionBaseDate, monthsToAdd);

    await currentPlan.update(
      {
        planVersionId: targetPlanVersion.id,
        status: "active",
        startDate,
        planExpiryDate: newExpiryDate,
        baseAmount: Number(currentPlan.baseAmount || 0) + baseAmount,
        amountPaid: Number(currentPlan.amountPaid || 0) + amountPaid,
        discountPercent,
        durationMonths: Number(currentPlan.durationMonths || 0) + monthsToAdd,
        autoRenew,
      },
      { transaction }
    );

    const hospital = await Doctor.findByPk(hospitalId, { transaction });
    if (hospital && hospital.accountStatus !== "active") {
      await hospital.update({ accountStatus: "active" }, { transaction });
    }

    const upcomingPlans = await HospitalPlan.findAll({
      where: { hospitalId, status: "upcoming" },
      order: [["startDate", "ASC"]],
      transaction,
    });

    let lastDate = new Date(currentPlan.planExpiryDate);
    for (const plan of upcomingPlans) {
      const nextStartDate = new Date(lastDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
      await plan.update(
        {
          startDate: nextStartDate,
          planExpiryDate: addMonths(nextStartDate, plan.durationMonths),
        },
        { transaction }
      );
      lastDate = new Date(plan.planExpiryDate);
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: `Plan extended by ${monthsToAdd} month(s) successfully.`,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to extend plan" });
  }
};
