const { Op } = require("sequelize");
const {
  AuditLog,
  Bed,
  BedTransfer,
  Doctor,
  IPDAdmission,
  IPDDischarge,
  IPDInvoice,
  IPDPayment,
  Patient,
  Room,
  Ward,
  sequelize,
} = require("../models");
const { encrypt, decrypt } = require("../utils/cryptography");
const { transformWithMapping } = require("../utils/transformWithMapping");

const { generateUniquePatientId } = require("./patientController");
const generatePaymentId = require("../utils/generatePaymnetId");

const getHospitalId = (req) => req.user?.hospitalId || req.user?.id;

const ACTIVE_ADMISSION = "admitted";

const includeAdmission = [
  {
    model: Patient,
    as: "patient",
    attributes: ["id", "name", "patientId", "mobileNumber", "age", "gender"],
  },
  { model: Ward, as: "ward", attributes: ["id", "wardName"] },
  { model: Room, as: "room", attributes: ["id", "roomNumber"] },
  { model: Bed, as: "bed", attributes: ["id", "bedCode", "bedType", "pricePerDay"] },
];

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "";

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

const toAmount = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const preferStoredRate = (storedRate, fallbackRate) => {
  const stored = Number(storedRate || 0);
  return stored > 0 ? stored : Number(fallbackRate || 0);
};

const getBillingEndDate = (admission, fallbackDate = new Date()) => {
  if (admission?.dischargedAt) return new Date(admission.dischargedAt);
  return fallbackDate ? new Date(fallbackDate) : new Date();
};

const calculateStayDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!startDate || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diff = Math.max(end.getTime() - start.getTime(), 0);
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const calculateAdmissionBilling = async (admission, endDate = new Date(), transaction) => {
  const admissionJson = typeof admission.toJSON === "function" ? admission.toJSON() : admission;
  const billingEndDate = getBillingEndDate(admissionJson, endDate);
  const admissionDate = new Date(admissionJson.admissionDate);
  const transfers = await BedTransfer.findAll({
    where: {
      admissionId: admissionJson.id,
      doctorId: admissionJson.doctorId,
      status: "completed",
      transferredAt: { [Op.lte]: billingEndDate },
    },
    include: [
      { model: Bed, as: "fromBed", attributes: ["id", "bedCode", "bedType", "pricePerDay"] },
      { model: Bed, as: "toBed", attributes: ["id", "bedCode", "bedType", "pricePerDay"] },
      { model: Ward, as: "fromWard", attributes: ["id", "wardName"] },
      { model: Ward, as: "toWard", attributes: ["id", "wardName"] },
      { model: Room, as: "fromRoom", attributes: ["id", "roomNumber"] },
      { model: Room, as: "toRoom", attributes: ["id", "roomNumber"] },
    ],
    order: [["transferredAt", "ASC"]],
    transaction,
  });

  const sortedTransfers = transfers.map((transfer) => transfer.toJSON());
  const firstTransfer = sortedTransfers[0];
  const currentBed = admissionJson.bed || {};
  let activeBed = firstTransfer
    ? {
      id: firstTransfer.fromBedId,
      bedCode: firstTransfer.fromBed?.bedCode,
      bedType: firstTransfer.fromBed?.bedType,
      pricePerDay: preferStoredRate(firstTransfer.fromBedChargePerDay, firstTransfer.fromBed?.pricePerDay),
      ward: firstTransfer.fromWard?.wardName,
      room: firstTransfer.fromRoom?.roomNumber ? `Room ${firstTransfer.fromRoom.roomNumber}` : "",
    }
    : {
      id: admissionJson.bedId,
      bedCode: currentBed.bedCode,
      bedType: currentBed.bedType,
      pricePerDay: currentBed.pricePerDay || 0,
      ward: admissionJson.ward?.wardName,
      room: admissionJson.room?.roomNumber ? `Room ${admissionJson.room.roomNumber}` : "",
    };

  const periods = [];
  let periodStart = admissionDate;

  sortedTransfers.forEach((transfer) => {
    const transferDate = new Date(transfer.transferredAt);
    if (transferDate > periodStart) {
      periods.push({
        bedId: activeBed.id,
        bedCode: activeBed.bedCode,
        bedType: activeBed.bedType,
        ward: activeBed.ward,
        room: activeBed.room,
        pricePerDay: Number(activeBed.pricePerDay || 0),
        from: periodStart,
        to: transferDate,
      });
    }

    activeBed = {
      id: transfer.toBedId,
      bedCode: transfer.toBed?.bedCode,
      bedType: transfer.toBed?.bedType,
      pricePerDay: preferStoredRate(transfer.toBedChargePerDay, transfer.toBed?.pricePerDay),
      ward: transfer.toWard?.wardName,
      room: transfer.toRoom?.roomNumber ? `Room ${transfer.toRoom.roomNumber}` : "",
    };
    periodStart = transferDate;
  });

  if (billingEndDate >= periodStart) {
    periods.push({
      bedId: activeBed.id,
      bedCode: activeBed.bedCode,
      bedType: activeBed.bedType,
      ward: activeBed.ward,
      room: activeBed.room,
      pricePerDay: Number(activeBed.pricePerDay || 0),
      from: periodStart,
      to: billingEndDate,
    });
  }

  const stayDays = calculateStayDays(admissionDate, billingEndDate);
  const bedChargePerDay = Number(activeBed.pricePerDay || currentBed.pricePerDay || 0);
  const bedCharge = roundAmount(stayDays * bedChargePerDay);

  let allocatedDays = 0;
  const bedHistory = periods.map((period, index) => {
    const rawDays = Math.max(
      (new Date(period.to).getTime() - new Date(period.from).getTime()) / (1000 * 60 * 60 * 24),
      0
    );
    let billableDays;
    if (periods.length === 1) {
      billableDays = stayDays;
    } else if (index < periods.length - 1) {
      billableDays = Math.max(1, Math.round(rawDays));
      allocatedDays += billableDays;
    } else {
      billableDays = Math.max(1, stayDays - allocatedDays);
    }

    const price = Number(period.pricePerDay || bedChargePerDay);
    const amount = roundAmount(price * billableDays);
    return {
      ...period,
      from: period.from,
      to: period.to,
      days: billableDays,
      amount,
    };
  });

  return {
    stayDays,
    bedCharge,
    bedChargePerDay,
    bedHistory,
  };
};

const createSequence = async (Model, field, prefix, doctorId, transaction) => {
  const year = new Date().getFullYear();
  const count = await Model.count({ where: { doctorId }, transaction });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
};

const getSearchMapping = async (doctorId, transaction) => {
  const doctor = await Doctor.findOne({
    where: { id: doctorId },
    attributes: ["mapping"],
    transaction,
  });
  return JSON.parse(decrypt(doctor?.mapping)) || {};
};

const auditMetadataOnly = async (req, action, entity, entityId, transaction) => {
  if (!AuditLog) return;

  await AuditLog.create(
    {
      action,
      details: `${action} ${entity} record`,
      hospitalId: getHospitalId(req),
      receptionistId: req?.user?.role === "receptionist" ? req.user.id : null,
      doctorId: req?.user?.role === "doctor" ? req.user.id : null,
      subDoctorId: req?.user?.role === "subDoctor" ? req.user.id : null,
      role: req?.user?.role || "doctor",
      token: req?.header ? req.header("Authorization")?.split(" ")[1] : null,
      entity,
      entityId,
      oldValue: null,
      newValue: null,
      status: "success",
      endpoint: req?.originalUrl || "/api/ipd",
      ipAddress: req?.clientIp || "127.0.0.1",
      userAgent: req.headers["user-agent"],
    },
    { transaction }
  );
};

const decryptSafe = (value) => {
  if (!value) return value;
  try {
    return decrypt(value);
  } catch (error) {
    console.error("DECRYPT FAILED:", error.message, "| raw value:", value);
    return value;
  }
};

const formatAdmission = (admission) => {
  const item = admission.toJSON();
  const patient = item.patient || {};

  return {
    id: item.id,
    admissionNumber: item.admissionNumber,
    name: decryptSafe(patient.name),
    patientId: patient.id,
    mrn: patient.patientId,
    phone: decryptSafe(patient.mobileNumber),
    age: patient.age,
    gender: patient.gender,
    diagnosis: item.diagnosis || item.admissionReason,
    doctor: item.attendingDoctorName,
    doctorRole: item.doctorRole || item.department,
    department: item.department,
    wardId: item.wardId,
    roomId: item.roomId,
    bedId: item.bedId,
    ward: item.ward?.wardName,
    room: `Room ${item.room?.roomNumber || ""}`.trim(),
    currentBed: item.bed?.bedCode,
    bedChargePerDay: Number(item.bed?.pricePerDay || 0),
    admissionDate: formatDate(item.admissionDate),
    admissionTime: formatTime(item.admissionDate),
    admissionDateTime: item.admissionDate,
    advancePayment: Number(item.advancePayment || 0),
    status: item.clinicalStatus,
    admissionStatus: item.status,
  };
};

const formatInvoice = (invoice) => {
  const item = invoice.toJSON();
  const admission = item.admission || {};
  const patient = item.patient || admission.patient || {};
  const bed = admission.bed || {};

  const payments = (item.payments || []).map((p) => ({
    id: p.id,
    amount: Number(p.amount || 0),
    paymentDate: formatDate(p.paymentDate) || p.paymentDate,
    rawPaymentDate: p.paymentDate,
    paymentMode: p.paymentMode || "Cash",
    notes: p.notes || "",
  }));

  const totalAmount = Number(item.totalAmount || 0);
  const paidFromPayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.length > 0 ? paidFromPayments : Number(item.paidAmount || 0);
  const dueAmount = Math.max(totalAmount - paidAmount, 0);
  const paymentStatus = dueAmount === 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Unpaid";

  return {
    id: item.id,
    invoiceNo: item.invoiceNo,
    admissionId: item.admissionId,
    patient: {
      id: patient.id,
      name: decryptSafe(patient.name),
      mrn: patient.patientId,
      age: patient.age,
      gender: patient.gender,
    },
    admissionDate: formatDate(admission.admissionDate),
    admissionTime: formatTime(admission.admissionDate),
    dischargeDate: admission.dischargedAt ? formatDate(admission.dischargedAt) : "",
    dischargeTime: admission.dischargedAt ? formatTime(admission.dischargedAt) : "",
    stayDays: item.stayDays,
    doctor: admission.attendingDoctorName,
    ward: admission.ward?.wardName,
    room: `Room ${admission.room?.roomNumber || ""}`.trim(),
    bed: `Bed ${bed.bedCode || ""}`.trim(),
    bedChargePerDay: Number(item.bedChargePerDay || 0),
    bedCharge: Number(item.bedCharge || 0),
    medicalCharges: Number(item.medicalCharges || 0),
    otherCharges: Number(item.otherCharges || 0),
    totalAmount,
    paidAmount,
    paymentStatus,
    paidDate: item.paidDate ? formatDate(item.paidDate) : "",
    dueAmount,
    payments,
  };
};

const invoiceInclude = [
  {
    model: IPDAdmission,
    as: "admission",
    include: includeAdmission,
  },
  {
    model: Patient,
    as: "patient",
    attributes: ["id", "name", "patientId", "age", "gender"],
  },
  {
    model: IPDPayment,
    as: "payments",
  },
];

exports.createAdmission = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const {
      existingPatientId,
      patientName,
      mobileNumber,
      address,
      age,
      dateOfBirth,
      bloodGroup,
      gender,
      bedId,
      attendingDoctorName,
      doctorRole,
      department,
      admissionReason,
      diagnosis,
      clinicalStatus,
      admissionDate,
      advancePayment,
    } = req.body;

    const parsedAge = toPositiveInteger(age);

    if (!existingPatientId) {
      if (
        !patientName?.trim() ||
        !mobileNumber?.trim() ||
        !address?.trim() ||
        !parsedAge ||
        !dateOfBirth ||
        !bloodGroup?.trim() ||
        !gender?.trim()
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Patient details are required for a new patient.",
        });
      }
    }

    const resolvedDepartment = department?.trim() || doctorRole?.trim() || "General Medicine";

    if (
      !bedId ||
      !attendingDoctorName?.trim() ||
      !resolvedDepartment ||
      !admissionReason?.trim()
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Bed, doctor, department, and admission reason are required.",
      });
    }

    const bed = await Bed.findOne({
      where: { id: bedId, doctorId },
      include: [{ model: Room, as: "room", attributes: ["id", "wardId"] }],
      transaction,
    });
    if (!bed) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Bed not found." });
    }
    if (bed.status !== "available" && bed.status !== "discharged") {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Bed is not available." });
    }

    const parsedAdvance = toAmount(advancePayment);
    if (parsedAdvance === null) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid advance payment." });
    }

    let patient;

    if (existingPatientId) {
      patient = await Patient.findOne({
        where: { id: existingPatientId, doctorId },
        transaction,
      });
      if (!patient) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Patient not found." });
      }
    } else {
      const trimmedName = patientName.trim();
      const trimmedMobile = mobileNumber.trim();
      const trimmedAddress = address.trim();

      const mapping = await getSearchMapping(doctorId, transaction);
      const nameSearch = transformWithMapping(trimmedName, mapping);
      const mobileSearch = transformWithMapping(trimmedMobile, mapping);

      patient = await Patient.findOne({
        where: { doctorId, nameSearch, mobileSearch },
        transaction,
      });

      if (patient) {
        const backfill = {};
        if (!patient.address) backfill.address = trimmedAddress;
        if (!patient.age) backfill.age = parsedAge;
        if (!patient.dateOfBirth) backfill.dateOfBirth = dateOfBirth;
        if (!patient.bloodGroup) backfill.bloodGroup = bloodGroup.trim();
        if (!patient.gender) backfill.gender = gender.trim();
        if (Object.keys(backfill).length) {
          await patient.update(backfill, { transaction });
        }
      } else {
        const patientMrn = await generateUniquePatientId(trimmedName);
        patient = await Patient.create(
          {
            name: trimmedName,
            nameSearch,
            mobileSearch,
            patientId: patientMrn,
            mobileNumber: trimmedMobile,
            address: trimmedAddress,
            age: parsedAge,
            dateOfBirth,
            bloodGroup: bloodGroup.trim(),
            gender: gender.trim(),
            doctorId,
          },
          { transaction }
        );
      }
    }

    const activeAdmission = await IPDAdmission.findOne({
      where: { patientId: patient.id, doctorId, status: ACTIVE_ADMISSION },
      transaction,
    });
    if (activeAdmission) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "This patient already has an active admission.",
      });
    }

    const admissionNumber = await createSequence(
      IPDAdmission,
      "admissionNumber",
      "ADM",
      doctorId,
      transaction
    );
    const admission = await IPDAdmission.create(
      {
        admissionNumber,
        patientId: patient.id,
        bedId: bed.id,
        roomId: bed.roomId,
        wardId: bed.wardId,
        doctorId,
        attendingDoctorName: attendingDoctorName.trim(),
        doctorRole: doctorRole?.trim() || null,
        department: resolvedDepartment,
        admissionReason: admissionReason.trim(),
        diagnosis: diagnosis?.trim() || null,
        clinicalStatus: clinicalStatus || "Stable",
        admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
        advancePayment: parsedAdvance,
      },
      { transaction }
    );

    await bed.update({ status: "occupied", patientId: patient.id }, { transaction });
    await auditMetadataOnly(req, "CREATE_IPD_ADMISSION", "IPDAdmission", admission.id, transaction);
    await transaction.commit();

    const admissionWithDetails = await IPDAdmission.findByPk(admission.id, {
      include: includeAdmission,
    });

    return res.status(201).json({
      success: true,
      message: "Patient admitted successfully",
      admission: formatAdmission(admissionWithDetails),
    });
  } catch (error) {
    console.error("createAdmission error:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: error.message || "Failed to admit patient." });
  }
};

exports.getAdmissions = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { searchTerm, doctor, ward, admissionDate, status = ACTIVE_ADMISSION } = req.query;
    const where = { doctorId };
    const patientWhere = {};
    const wardWhere = {};

    if (status !== "all") where.status = status;
    if (doctor && doctor !== "All Doctors") where.attendingDoctorName = doctor;
    if (admissionDate) {
      const start = new Date(admissionDate);
      const end = new Date(admissionDate);
      end.setDate(end.getDate() + 1);
      where.admissionDate = { [Op.gte]: start, [Op.lt]: end };
    }
    if (ward && ward !== "All Wards") wardWhere.wardName = ward;
    if (searchTerm) {
      const mapping = await getSearchMapping(doctorId);
      const transformedSearch = transformWithMapping(searchTerm, mapping);
      patientWhere[Op.or] = [
        { nameSearch: { [Op.like]: `%${transformedSearch}%` } },
        { mobileSearch: { [Op.like]: `%${transformedSearch}%` } },
        { patientId: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const admissions = await IPDAdmission.findAll({
      where,
      include: [
        {
          ...includeAdmission[0],
          where: Object.keys(patientWhere).length ? patientWhere : undefined,
        },
        {
          ...includeAdmission[1],
          where: Object.keys(wardWhere).length ? wardWhere : undefined,
        },
        includeAdmission[2],
        includeAdmission[3],
      ],
      order: [["admissionDate", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      admissions: admissions.map(formatAdmission),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get admissions." });
  }
};

exports.getAdmissionById = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const admission = await IPDAdmission.findOne({
      where: { id: req.params.id, doctorId },
      include: includeAdmission,
    });

    if (!admission) {
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    return res.status(200).json({ success: true, admission: formatAdmission(admission) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get admission." });
  }
};

exports.getAdmissionBillingSummary = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const admission = await IPDAdmission.findOne({
      where: { id: req.params.id, doctorId },
      include: includeAdmission,
    });

    if (!admission) {
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    const billing = await calculateAdmissionBilling(admission, new Date());
    return res.status(200).json({
      success: true,
      billing: {
        ...billing,
        bedHistory: billing.bedHistory.map((period) => ({
          ...period,
          from: period.from ? formatDate(period.from) : "",
          to: period.to ? formatDate(period.to) : "",
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get billing summary." });
  }
};

exports.getTransferOptions = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const admissions = await IPDAdmission.findAll({
      where: { doctorId, status: ACTIVE_ADMISSION },
      include: includeAdmission,
      order: [["admissionDate", "DESC"]],
    });
    const availableBeds = await Bed.findAll({
      where: { doctorId, status: { [Op.in]: ["available", "discharged"] } },
      include: [
        { model: Ward, as: "ward", attributes: ["id", "wardName"] },
        { model: Room, as: "room", attributes: ["id", "roomNumber"] },
      ],
      order: [
        [{ model: Ward, as: "ward" }, "wardName", "ASC"],
        [{ model: Room, as: "room" }, "roomNumber", "ASC"],
        ["bedCode", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      admissions: admissions.map(formatAdmission),
      availableBeds: availableBeds.map((bed) => {
        const item = bed.toJSON();
        return {
          id: item.id,
          wardId: item.wardId,
          roomId: item.roomId,
          wardName: item.ward?.wardName,
          roomNumber: item.room?.roomNumber,
          bedCode: item.bedCode,
          bedType: item.bedType,
          bedChargePerDay: Number(item.pricePerDay || 0),
          status: item.status,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get transfer options." });
  }
};

exports.transferBed = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const { admissionId, toBedId, reason, transferredAt } = req.body;

    if (!admissionId || !toBedId || !reason?.trim()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Admission, new bed, and transfer reason are required.",
      });
    }

    const admission = await IPDAdmission.findOne({
      where: { id: admissionId, doctorId, status: ACTIVE_ADMISSION },
      transaction,
    });
    if (!admission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Active admission not found." });
    }

    const [fromBed, toBed] = await Promise.all([
      Bed.findOne({ where: { id: admission.bedId, doctorId }, transaction }),
      Bed.findOne({ where: { id: toBedId, doctorId }, transaction }),
    ]);

    if (!toBed || (toBed.status !== "available" && toBed.status !== "discharged")) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Selected bed is not available." });
    }
    if (Number(toBed.id) === Number(fromBed?.id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Select a different bed." });
    }

    const transferNumber = await createSequence(
      BedTransfer,
      "transferNumber",
      "TRF",
      doctorId,
      transaction
    );

    const transfer = await BedTransfer.create(
      {
        transferNumber,
        admissionId: admission.id,
        patientId: admission.patientId,
        fromWardId: admission.wardId,
        fromRoomId: admission.roomId,
        fromBedId: admission.bedId,
        toWardId: toBed.wardId,
        toRoomId: toBed.roomId,
        toBedId: toBed.id,
        fromBedChargePerDay: Number(fromBed?.pricePerDay || 0),
        toBedChargePerDay: Number(toBed.pricePerDay || 0),
        doctorId,
        reason: reason.trim(),
        transferredAt: transferredAt ? new Date(transferredAt) : new Date(),
      },
      { transaction }
    );

    if (fromBed) {
      await fromBed.update({ status: "available", patientId: null }, { transaction });
    }
    await toBed.update({ status: "occupied", patientId: admission.patientId }, { transaction });
    await admission.update(
      { wardId: toBed.wardId, roomId: toBed.roomId, bedId: toBed.id },
      { transaction }
    );

    await auditMetadataOnly(req, "TRANSFER_IPD_BED", "BedTransfer", transfer.id, transaction);
    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Bed transferred successfully",
      transfer,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to transfer bed." });
  }
};

exports.getRecentTransfers = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const parsedLimit = Number(req.query.limit);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

    const transfers = await BedTransfer.findAll({
      where: { doctorId },
      include: [
        { model: Patient, as: "patient", attributes: ["id", "name", "patientId"] },
        { model: Ward, as: "fromWard", attributes: ["id", "wardName"] },
        { model: Room, as: "fromRoom", attributes: ["id", "roomNumber"] },
        { model: Bed, as: "fromBed", attributes: ["id", "bedCode", "pricePerDay"] },
        { model: Ward, as: "toWard", attributes: ["id", "wardName"] },
        { model: Room, as: "toRoom", attributes: ["id", "roomNumber"] },
        { model: Bed, as: "toBed", attributes: ["id", "bedCode", "bedType", "pricePerDay", "status"] },
        {
          model: IPDAdmission,
          as: "admission",
          attributes: ["id", "status"],
          where: { status: ACTIVE_ADMISSION },
          required: true,
        },
      ],
      order: [["transferredAt", "DESC"]],
      ...(limit ? { limit } : {}),
    });

    return res.status(200).json({
      success: true,
      transfers: transfers.map((transfer) => {
        const item = transfer.toJSON();
        return {
          id: item.id,
          admissionId: item.admissionId,
          patientId: item.patientId,
          patient: decryptSafe(item.patient?.name),
          mrn: item.patient?.patientId,
          reason: item.reason || "",
          fromWard: item.fromWard?.wardName || "",
          fromRoom: item.fromRoom?.roomNumber ? `Room ${item.fromRoom.roomNumber}` : "",
          fromBed: item.fromBed?.bedCode || "",
          fromBedChargePerDay: preferStoredRate(item.fromBedChargePerDay, item.fromBed?.pricePerDay),
          toWard: item.toWard?.wardName || "",
          toRoom: item.toRoom?.roomNumber ? `Room ${item.toRoom.roomNumber}` : "",
          toBed: item.toBed?.bedCode || "",
          toBedType: item.toBed?.bedType || "",
          toBedChargePerDay: preferStoredRate(item.toBedChargePerDay, item.toBed?.pricePerDay),
          toBedStatus: item.toBed?.status || "",
          dateTime: `${formatDate(item.transferredAt)}, ${formatTime(item.transferredAt)}`,
          status: item.status === "completed" ? "Completed" : "Cancelled",
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get transfers." });
  }
};

exports.createDischarge = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const {
      admissionId,
      diagnosis,
      medicalCharges,
      otherCharges,
      invoiceId,
      dischargeDate,
      dischargeTime,
      summaryNotes,
      status = "Discharged",
    } = req.body;

    if (!admissionId || !diagnosis?.trim() || !dischargeDate) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Admission, diagnosis, and discharge date are required.",
      });
    }

    const parsedMedicalCharges = toAmount(medicalCharges);
    const parsedOtherCharges = toAmount(otherCharges);
    if (parsedMedicalCharges === null || parsedOtherCharges === null) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid billing details." });
    }

    const admission = await IPDAdmission.findOne({
      where: { id: admissionId, doctorId },
      include: includeAdmission,
      transaction,
    });
    if (!admission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    const existingDischarge = await IPDDischarge.findOne({
      where: { admissionId: admission.id, doctorId },
      transaction,
    });
    if (existingDischarge) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Discharge already exists for this admission.",
      });
    }

    const billingEndDate = new Date(`${dischargeDate}T${dischargeTime || "00:00"}`);
    const billing = await calculateAdmissionBilling(admission, billingEndDate, transaction);
    const parsedFinalBill = roundAmount(
      billing.bedCharge + parsedMedicalCharges + parsedOtherCharges
    );
    const linkedInvoice = invoiceId
      ? await IPDInvoice.findOne({
        where: { id: invoiceId, admissionId: admission.id, doctorId },
        transaction,
      })
      : null;

    const dischargeId = await createSequence(
      IPDDischarge,
      "dischargeId",
      "DC",
      doctorId,
      transaction
    );

    const discharge = await IPDDischarge.create(
      {
        dischargeId,
        admissionId: admission.id,
        patientId: admission.patientId,
        doctorId,
        diagnosis: diagnosis.trim(),
        stayDays: billing.stayDays,
        bedCharge: billing.bedCharge,
        medicalCharges: parsedMedicalCharges,
        otherCharges: parsedOtherCharges,
        finalBill: parsedFinalBill,
        dischargeDate,
        dischargeTime: dischargeTime || null,
        summaryNotes: summaryNotes?.trim() || null,
        invoiceId: linkedInvoice?.id || null,
        status,
      },
      { transaction }
    );

    if (status === "Discharged") {
      await admission.update(
        {
          status: "discharged",
          diagnosis: diagnosis.trim(),
          dischargedAt: new Date(`${dischargeDate}T${dischargeTime || "00:00"}`),
        },
        { transaction }
      );
      await Bed.update(
        { status: "available", patientId: null },
        { where: { id: admission.bedId, doctorId }, transaction }
      );
    }

    await auditMetadataOnly(req, "CREATE_IPD_DISCHARGE", "IPDDischarge", discharge.id, transaction);
    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Discharge recorded successfully",
      discharge,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to discharge patient." });
  }
};

exports.getDischarges = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { searchTerm, ward, status, fromDate, toDate } = req.query;
    const where = { doctorId };
    const patientWhere = {};
    const wardWhere = {};

    if (status && status !== "All Status") where.status = status;
    if (fromDate || toDate) {
      where.dischargeDate = {};
      if (fromDate) where.dischargeDate[Op.gte] = fromDate;
      if (toDate) where.dischargeDate[Op.lte] = toDate;
    }
    if (ward && ward !== "All Wards") wardWhere.wardName = ward;
    if (searchTerm) {
      const mapping = await getSearchMapping(doctorId);
      const transformedSearch = transformWithMapping(searchTerm, mapping);
      patientWhere[Op.or] = [
        { nameSearch: { [Op.like]: `%${transformedSearch}%` } },
        { patientId: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const discharges = await IPDDischarge.findAll({
      where,
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "patientId", "gender"],
          where: Object.keys(patientWhere).length ? patientWhere : undefined,
        },
        {
          model: IPDAdmission,
          as: "admission",
          include: [
            { model: Ward, as: "ward", attributes: ["id", "wardName"], where: Object.keys(wardWhere).length ? wardWhere : undefined },
            { model: Room, as: "room", attributes: ["id", "roomNumber"] },
            { model: Bed, as: "bed", attributes: ["id", "bedCode"] },
          ],
        },
      ],
      order: [["dischargeDate", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      discharges: discharges.map((record) => {
        const item = record.toJSON();
        return {
          id: item.id,
          dischargeId: item.dischargeId,
          patientName: decryptSafe(item.patient?.name),
          mrn: item.patient?.patientId,
          wardRoomBed: `${item.admission?.ward?.wardName || ""} / ${item.admission?.room?.roomNumber || ""} / ${item.admission?.bed?.bedCode || ""}`,
          dischargeDate: formatDate(item.dischargeDate),
          dischargeDateValue: item.dischargeDate,
          dischargeTime: item.dischargeTime || "",
          diagnosis: item.diagnosis,
          summaryNotes: item.summaryNotes,
          gender: item.patient?.gender,
          stayDays: Number(item.stayDays || 0),
          bedCharge: Number(item.bedCharge || 0),
          medicalCharges: Number(item.medicalCharges || 0),
          otherCharges: Number(item.otherCharges || 0),
          finalBill: Number(item.finalBill || 0),
          status: item.status,
          doctor: item.admission?.attendingDoctorName,
          doctorRole: item.admission?.doctorRole,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get discharges." });
  }
};

exports.createInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const {
      admissionId,
      medicalCharges,
      otherCharges,
      paidAmount,
    } = req.body;
    const parsedMedicalCharges = toAmount(medicalCharges);
    const parsedOtherCharges = toAmount(otherCharges);
    const parsedPaidAmount = toAmount(paidAmount);

    if (
      !admissionId ||
      parsedMedicalCharges === null ||
      parsedOtherCharges === null ||
      parsedPaidAmount === null
    ) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Valid billing details are required." });
    }

    const admission = await IPDAdmission.findOne({
      where: { id: admissionId, doctorId },
      include: includeAdmission,
      transaction,
    });
    if (!admission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    const billing = await calculateAdmissionBilling(admission, new Date(), transaction);
    const bedCharge = billing.bedCharge;
    const totalAmount = bedCharge + parsedMedicalCharges + parsedOtherCharges;
    const dueAmount = Math.max(totalAmount - parsedPaidAmount, 0);
    const paymentStatus =
      dueAmount === 0 ? "Paid" : parsedPaidAmount > 0 ? "Partial" : "Pending";

    const invoiceNo = await createSequence(IPDInvoice, "invoiceNo", "INV", doctorId, transaction);
    const invoice = await IPDInvoice.create(
      {
        invoiceNo,
        admissionId: admission.id,
        patientId: admission.patientId,
        doctorId,
        bedChargePerDay: billing.bedChargePerDay,
        stayDays: billing.stayDays,
        bedCharge,
        medicalCharges: parsedMedicalCharges,
        otherCharges: parsedOtherCharges,
        totalAmount,
        paidAmount: parsedPaidAmount,
        dueAmount,
        paymentStatus,
        paidDate: paymentStatus === "Paid" ? new Date() : null,
      },
      { transaction }
    );

    if (parsedPaidAmount > 0) {
      const paymentId = await generatePaymentId(IPDPayment);

      if (!paymentId) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Payment Id not generated." });
      }
      await IPDPayment.create(
        {
          invoiceId: invoice.id,
          admissionId: admission.id,
          patientId: admission.patientId,
          doctorId,
          amount: parsedPaidAmount,
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMode: req.body.paymentMode || "Cash",
          notes: "Initial payment upon invoice generation",
          paymentId,
        },
        { transaction }
      );
    }

    await auditMetadataOnly(req, "CREATE_IPD_INVOICE", "IPDInvoice", invoice.id, transaction);
    await transaction.commit();

    const createdInvoice = await IPDInvoice.findByPk(invoice.id, { include: invoiceInclude });
    return res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      invoice: formatInvoice(createdInvoice),
    });
  } catch (error) {
  if (transaction && !transaction.finished) await transaction.rollback();
  console.error("CREATE INVOICE ERROR:", error); // TEMP DEBUG LOG
  return res.status(500).json({ success: false, message: "Failed to generate invoice." });
}
};

exports.updateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const {
      medicalCharges,
      otherCharges,
      paidAmount,
    } = req.body;
    const parsedMedicalCharges = toAmount(medicalCharges);
    const parsedOtherCharges = toAmount(otherCharges);
    const parsedPaidAmount = toAmount(paidAmount);

    if (
      parsedMedicalCharges === null ||
      parsedOtherCharges === null ||
      parsedPaidAmount === null
    ) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Valid billing details are required." });
    }

    const invoice = await IPDInvoice.findOne({
      where: { doctorId, invoiceNo: req.params.invoiceNo },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const admission = await IPDAdmission.findOne({
      where: { id: invoice.admissionId, doctorId },
      include: includeAdmission,
      transaction,
    });
    if (!admission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    const existingPayments = await IPDPayment.findAll({
      where: { invoiceId: invoice.id },
      transaction,
    });
    const sumExisting = existingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const finalPaidAmount = existingPayments.length > 0 ? sumExisting : parsedPaidAmount;

    const billing = await calculateAdmissionBilling(admission, new Date(), transaction);
    const totalAmount = billing.bedCharge + parsedMedicalCharges + parsedOtherCharges;
    const dueAmount = Math.max(totalAmount - finalPaidAmount, 0);
    const paymentStatus =
      dueAmount === 0 ? "Paid" : finalPaidAmount > 0 ? "Partial" : "Pending";

    await invoice.update(
      {
        bedChargePerDay: billing.bedChargePerDay,
        stayDays: billing.stayDays,
        bedCharge: billing.bedCharge,
        medicalCharges: parsedMedicalCharges,
        otherCharges: parsedOtherCharges,
        totalAmount,
        paidAmount: finalPaidAmount,
        dueAmount,
        paymentStatus,
        paidDate: paymentStatus === "Paid" ? new Date() : null,
      },
      { transaction }
    );

    await auditMetadataOnly(req, "UPDATE_IPD_INVOICE", "IPDInvoice", invoice.id, transaction);
    await transaction.commit();

    const updatedInvoice = await IPDInvoice.findByPk(invoice.id, { include: invoiceInclude });
    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      invoice: formatInvoice(updatedInvoice),
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to update invoice." });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { searchTerm, doctor, ward, fromDate, toDate, admissionId, patientId } = req.query;
    const where = { doctorId };
    const patientWhere = {};
    const admissionWhere = {};
    const wardWhere = {};

    if (searchTerm) {
      where[Op.or] = [{ invoiceNo: { [Op.like]: `%${searchTerm}%` } }];
      const mapping = await getSearchMapping(doctorId);
      const transformedSearch = transformWithMapping(searchTerm, mapping);
      patientWhere[Op.or] = [
        { nameSearch: { [Op.like]: `%${transformedSearch}%` } },
        { patientId: { [Op.like]: `%${searchTerm}%` } },
      ];
    }
    if (doctor && doctor !== "All Doctors") admissionWhere.attendingDoctorName = doctor;
    if (ward && ward !== "All Wards") wardWhere.wardName = ward;
    if (admissionId) where.admissionId = admissionId;
    if (patientId) where.patientId = patientId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt[Op.lt] = endDate;
      }
    }

    const invoices = await IPDInvoice.findAll({
      where,
      include: [
        {
          model: IPDAdmission,
          as: "admission",
          where: Object.keys(admissionWhere).length ? admissionWhere : undefined,
          include: [
            {
              model: Patient,
              as: "patient",
              attributes: ["id", "name", "patientId", "age", "gender"],
              where: Object.keys(patientWhere).length ? patientWhere : undefined,
              required: Object.keys(patientWhere).length > 0,
            },
            { model: Ward, as: "ward", attributes: ["id", "wardName"], where: Object.keys(wardWhere).length ? wardWhere : undefined },
            { model: Room, as: "room", attributes: ["id", "roomNumber"] },
            { model: Bed, as: "bed", attributes: ["id", "bedCode", "pricePerDay"] },
          ],
        },
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "patientId", "age", "gender"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      invoices: invoices.map(formatInvoice),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get invoices." });
  }
};

exports.getInvoiceByNumber = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const invoice = await IPDInvoice.findOne({
      where: { doctorId, invoiceNo: req.params.invoiceNo },
      include: invoiceInclude,
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    return res.status(200).json({ success: true, invoice: formatInvoice(invoice) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get invoice." });
  }
};

exports.getInvoiceStats = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const invoices = await IPDInvoice.findAll({ where: { doctorId } });
    const stats = invoices.reduce(
      (acc, invoice) => {
        const item = invoice.toJSON();
        acc.totalInvoices += 1;
        acc.totalAmount += Number(item.totalAmount || 0);
        acc.paidAmount += Number(item.paidAmount || 0);
        acc.pendingAmount += Number(item.dueAmount || 0);
        return acc;
      },
      { totalInvoices: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 }
    );

    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get invoice stats." });
  }
};

exports.recordInvoicePayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const amount = toAmount(req.body.amount);
    if (amount === null || amount === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0." });
    }

    const invoice = await IPDInvoice.findOne({
      where: { doctorId, invoiceNo: req.params.invoiceNo },
      transaction,
    });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Invoice not found." });
    }

    const { paymentDate, paymentMode, notes } = req.body;
    const finalPaymentDate = paymentDate || new Date().toISOString().split("T")[0];
    const finalPaymentMode = paymentMode?.trim() || "Cash";
    const finalNotes = notes?.trim() || null;

    const paidAmount = Number(invoice.paidAmount || 0) + amount;
    const totalAmount = Number(invoice.totalAmount || 0);
    const dueAmount = Math.max(totalAmount - paidAmount, 0);
    const paymentStatus = dueAmount === 0 ? "Paid" : "Partial";

    await invoice.update(
      {
        paidAmount: Math.min(paidAmount, totalAmount),
        dueAmount,
        paymentStatus,
        paidDate: paymentStatus === "Paid" ? new Date(finalPaymentDate) : invoice.paidDate,
      },
      { transaction }
    );

    const paymentId = await generatePaymentId(IPDPayment);

    if (!paymentId) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Payment Id not generated." });
    }

    await IPDPayment.create(
      {
        paymentId,
        invoiceId: invoice.id,
        admissionId: invoice.admissionId,
        patientId: invoice.patientId,
        doctorId,
        amount,
        paymentDate: finalPaymentDate,
        paymentMode: finalPaymentMode,
        notes: finalNotes,
      },
      { transaction }
    );

    await auditMetadataOnly(req, "RECORD_IPD_PAYMENT", "IPDInvoice", invoice.id, transaction);
    await transaction.commit();

    return res.status(200).json({ success: true, message: "Payment recorded successfully." });
  } catch (error) {
    console.error("recordInvoicePayment error:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to record payment." });
  }
};