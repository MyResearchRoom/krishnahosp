const { Op, where } = require("sequelize");
const {
  AuditLog,
  Bed,
  BedTransfer,
  Doctor, SubDoctor,
  IPDAdmission,
  IPDAccount,
  IPDAccountCharge,
  IPDAccountPayment,
  PatientDocument,
  IPDDischarge,
  Patient,
  Room,
  Ward,
  ICUAdmission,
  sequelize,
} = require("../models");
const { decrypt, getDecryptedDocumentAsBase64 } = require("../utils/cryptography");
const { generatePatientId } = require("./patientController");
const { transformWithMapping } = require("../utils/transformWithMapping");
const generatePaymentId = require("../utils/generatePaymnetId");
const generateAccountNumber = require("../utils/generateAccountNumber");
const getHospitalId = (req) => req.user?.hospitalId;

const ACTIVE_ADMISSION = "admitted";

const createAdmissionSequence = async (Model, prefix, hospitalId, transaction) => {
  const year = new Date().getFullYear();
  const count = await Model.count({ where: { hospitalId }, transaction });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
};

const createSequence = async (Model, prefix, hospitalId, transaction) => {
  const year = new Date().getFullYear();
  const count = await Model.count({ where: { hospitalId }, transaction });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
};

const createBedSequence = async (Model, prefix, doctorId, transaction) => {
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

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toAmount = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const formatAdmission = (admission, logo = null,) => {
  const item = admission;
  const patient = item.patient.toJSON() || {};
  const discharge = item?.ipdAdmission?.discharge || {};

  const doctor = item?.attendingDoctor ? item.attendingDoctor : item.attendingSubDoctor;

  return {
    id: item.id,
    icuAdmissionNumber: item.icuAdmissionNumber,
    ipdAdmissionId: item.ipdAdmissionId,
    ipdAdmissionNumber: item?.ipdAdmission?.admissionNumber,
    admissionType: item.admissionType,
    patient: patient,
    patientName: decrypt(patient.name),
    patientId: patient.id,
    patientUniqueId: patient.patientId,
    phone: decrypt(patient.mobileNumber),
    age: patient.age,
    gender: patient.gender,
    diagnosis: item.diagnosis || item.admissionReason,
    doctor: decrypt(doctor.name),
    doctorRole: item?.attendingDoctor ? "doctor" : "subDoctor",
    department: doctor.department,
    wardId: item.wardId,
    roomId: item.roomId,
    bedId: item.bedId,
    ward: item.ward?.wardName,
    wardType: item.ward?.wardType,
    room: `Room ${item.room?.roomNumber || ""}`.trim(),
    currentBed: item.bed?.bedCode,
    bedChargePerDay: Number(item.bed?.pricePerDay || 0),
    admissionDate: item.admissionDate,
    admissionTime: item.admissionTime,
    status: item.status,
    clinicalStatus: item.clinicalStatus,
    discharge,
    logo,
  };
};

exports.transferIPDToICU = async (req, res) => {
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
      where: {
        id: admissionId,
        hospitalId: doctorId,
        status: ACTIVE_ADMISSION
      },
      transaction,
    });

    if (!admission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Active admission not found." });
    }

    const account = await IPDAccount.findOne({
      where: {
        admissionId: admission.id,
        hospitalId: doctorId,
        status: "open",
      },
      transaction,
    });

    if (!account) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Open IPD account not found, So can not transfer bed.",
      });
    }

    const [fromBed, toBed] = await Promise.all([
      Bed.findOne({
        where: {
          id: admission.bedId,
          doctorId
        },
        transaction
      }),
      Bed.findOne({
        where: {
          id: toBedId,
          doctorId
        },
        transaction
      }),
    ]);

    const ward = await Ward.findOne({
      where: {
        id: toBed.wardId,
        doctorId,
      },
      transaction,
    });

    if (!ward) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Destination ward not found.",
      });
    }

    if (ward.wardType !== "ICU") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Selected bed does not belong to an ICU ward.",
      });
    }

    if (!toBed || !["available", "discharged"].includes(toBed.status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Selected bed is not available." });
    }

    if (Number(toBed.id) === Number(fromBed?.id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Select a different bed." });
    }

    const transferDate = transferredAt
      ? new Date(transferredAt)
      : new Date();

    if (Number.isNaN(transferDate.getTime())) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Invalid transfer date.",
      });
    }

    const currentBedCharge = await IPDAccountCharge.findOne({
      where: {
        accountId: account.id,
        chargeName: "Bed Charge",
        isActive: true,
      },
      order: [["id", "DESC"]],
      transaction,
    });

    if (!currentBedCharge) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Active bed not found, So can not transfer to new bed.",
      });
    }

    const activeAdmission = await ICUAdmission.findOne({
      where: {
        patientId: admission.patientId,
        hospitalId: doctorId,
        status: "ACTIVE",
      },
      transaction,
    });

    if (activeAdmission) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "This patient already has an active admission in ICU",
      });
    }

    const icuAdmissionNumber = await createAdmissionSequence(
      ICUAdmission,
      "ICU-ADM",
      doctorId,
      transaction
    );

    const now = new Date();

    await ICUAdmission.create(
      {
        icuAdmissionNumber,
        hospitalId: doctorId,
        patientId: admission.patientId,
        patientUniqueId: admission.patientUniqueId,
        ipdAdmissionId: admission.id,
        bedId: toBed.id,
        roomId: toBed.roomId,
        wardId: toBed.wardId,
        admissionDate: now.toISOString().split("T")[0],
        admissionTime: now.toTimeString().split(" ")[0],
        admissionType: "TRANSFER_FROM_IPD",
        admissionReason: reason,
        clinicalStatus: "Under Treatment",

        attendingDoctorId: admission.doctorId ? admission.doctorId : null,

        attendingSubDoctorId: admission.subDoctorId ? admission.subDoctorId : null,
        status: "ACTIVE",

      },
      { transaction }
    );

    const chargeStartDate = new Date(
      currentBedCharge.chargeDate
    );

    const oldStartDate = new Date(
      chargeStartDate.getFullYear(),
      chargeStartDate.getMonth(),
      chargeStartDate.getDate()
    );

    const newTransferDate = new Date(
      transferDate.getFullYear(),
      transferDate.getMonth(),
      transferDate.getDate()
    );

    const DAY_MS = 1000 * 60 * 60 * 24;

    const oldBedDays = Math.max(
      1,
      Math.floor(
        (newTransferDate.getTime() -
          oldStartDate.getTime()) /
        DAY_MS
      ) + 1
    );

    const oldUnitPrice = Number(
      currentBedCharge.unitPrice || 0
    );

    const oldTotalAmount = Number(
      (oldBedDays * oldUnitPrice).toFixed(2)
    );

    await currentBedCharge.update(
      {
        quantity: oldBedDays,
        totalAmount: oldTotalAmount,
        isActive: false,
      },
      {
        transaction,
      }
    );

    const newUnitPrice = Number(
      toBed.pricePerDay || 0
    );

    await IPDAccountCharge.create(
      {
        accountId: account.id,
        chargeName: "Bed Charge",
        quantity: 1,
        unitPrice: newUnitPrice,
        totalAmount: newUnitPrice,
        chargeDate: transferDate,
        remarks: `ICU transfer charge for bed ${toBed.bedCode || toBed.id} (${toBed.id})`,
        isActive: true,
      },
      {
        transaction,
      }
    );

    const charges = await IPDAccountCharge.findAll({
      where: {
        accountId: account.id,
      },
      transaction,
    });

    const totalAmount = charges.reduce(
      (sum, charge) =>
        sum + Number(charge.totalAmount || 0),
      0
    );

    const paidAmount = Number(account.paidAmount || 0);

    const discount = Number(account.discount || 0);

    const netAmount = Math.max(0, totalAmount - discount);

    const remainingAmount = Math.max(0, netAmount - paidAmount);

    let paymentStatus = "pending";

    if (paidAmount >= netAmount && netAmount > 0
    ) {
      paymentStatus = "paid";
    } else if (paidAmount > 0) {
      paymentStatus = "partial";
    }

    await account.update(
      {
        totalAmount,
        remainingAmount,
        paymentStatus,
      },
      {
        transaction,
      }
    );

    const transferNumber = await createBedSequence(
      BedTransfer,
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
        transferredAt: transferDate,
      },
      { transaction }
    );

    if (fromBed) {
      await fromBed.update({ status: "available", patientId: null }, { transaction });
    }

    await toBed.update({ status: "occupied", patientId: admission.patientId }, { transaction });

    await admission.update(
      {
        wardId: toBed.wardId,
        roomId: toBed.roomId,
        bedId: toBed.id,
        status: "transfer to ICU",
        clinicalStatus: "Under Treatment",
      },
      { transaction }
    );

    await auditMetadataOnly(req, "TRANSFER_IPD_BED_TO_ICU", "BedTransfer", transfer.id, transaction);

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Patient transferred to ICU successfully",
    });


  } catch (error) {
    console.error("Bed transfer error:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to transfer to ICU." });
  }
};

exports.createAdmission = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const hospitalId = getHospitalId(req);
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
      attendingDoctorId,
      admissionReason,
      diagnosis,
      clinicalStatus,
      admissionDate,
      advancePayment,
      type,
      admissionType,
    } = req.body;

    const parsedAge = toPositiveInteger(age);

    console.log("data", existingPatientId,
      patientName,
      mobileNumber,
      address,
      age,
      dateOfBirth,
      bloodGroup,
      gender,
      bedId,
      attendingDoctorName,
      attendingDoctorId,
      admissionReason,
      diagnosis,
      clinicalStatus,
      admissionDate,
      advancePayment,
      type,
      admissionType,);

    console.log("req data",
      !patientName?.trim(),
      !mobileNumber?.trim(),
      !address?.trim(),
      !parsedAge,
      !dateOfBirth,
      !gender?.trim()
    );



    if (!existingPatientId) {
      if (
        !patientName?.trim() ||
        !mobileNumber?.trim() ||
        !address?.trim() ||
        !parsedAge ||
        !dateOfBirth ||
        !gender?.trim()
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Patient details are required for a new patient.",
        });
      }
    }

    if (
      !bedId ||
      !attendingDoctorName?.trim() ||
      !attendingDoctorId ||
      !admissionReason?.trim()
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Bed, doctor, and admission reason are required.",
      });
    }

    const bed = await Bed.findOne({
      where: {
        id: bedId,
        doctorId: hospitalId
      },
      include: [
        {
          model: Room,
          as: "room",
          attributes: ["id", "wardId"],
        },
        {
          model: Ward,
          as: "ward",
          attributes: ["id", "wardName", "wardType"],
        },
      ],
      transaction,
    });

    if (!bed) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Bed not found." });
    }

    if (bed.ward.wardType !== "ICU") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Selected bed does not belong to an ICU ward.",
      });
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
        where: { id: existingPatientId, doctorId: hospitalId },
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

      const mapping = await getSearchMapping(hospitalId, transaction);
      const nameSearch = transformWithMapping(trimmedName, mapping);
      const mobileSearch = transformWithMapping(trimmedMobile, mapping);

      patient = await Patient.findOne({
        where: { doctorId: hospitalId, nameSearch, mobileSearch },
        transaction,
      });

      if (patient) {
        const backfill = {};
        if (!patient.address) backfill.address = trimmedAddress;
        if (!patient.age) backfill.age = parsedAge;
        if (!patient.dateOfBirth) backfill.dateOfBirth = dateOfBirth;
        if (bloodGroup) {
          if (!patient.bloodGroup) backfill.bloodGroup = bloodGroup.trim();
        }
        if (!patient.gender) backfill.gender = gender.trim();
        if (Object.keys(backfill).length) {
          await patient.update(backfill, { transaction });
        }
      } else {
        const patientMrn = await generatePatientId(
          Patient,
          req.user.hospitalId,
          transaction
        );
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
            bloodGroup: bloodGroup.trim() ?? null,
            gender: gender.trim(),
            doctorId: hospitalId,
          },
          { transaction }
        );
      }
    }

    const activeAdmission = await IPDAdmission.findOne({
      where: {
        patientId: patient.id,
        hospitalId: hospitalId,
        status: {
          [Op.in]: [
            "admitted",
            "transfer To ICU",
            "discharge Initiated",
          ],
        },
      },
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
      "ADM",
      hospitalId,
      transaction
    );

    let doctor, subDoctor;
    if (attendingDoctorName === "subDoctor") {

      subDoctor = await SubDoctor.findOne({
        where: { id: attendingDoctorId, addedBy: hospitalId },
        transaction,
      });

      if (!subDoctor) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Sub-Doctor not found." });
      }
    } else {
      const id = attendingDoctorId ? attendingDoctorId : hospitalId;
      doctor = await Doctor.findOne({
        where: { id },
        transaction,
      });
      if (!doctor) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Doctor not found." });
      }
    }

    const resolvedDepartment =
      attendingDoctorName === "doctor"
        ? doctor?.department
        : attendingDoctorName === "subDoctor"
          ? subDoctor?.department : "General";

    const resolvedDoctorName =
      attendingDoctorName === "doctor"
        ? decrypt(doctor?.name)
        : attendingDoctorName === "subDoctor"
          ? decrypt(subDoctor?.name)
          : "Admin doctor";

    const admissionDateTime = admissionDate
      ? new Date(admissionDate)
      : new Date();

    const admission = await IPDAdmission.create(
      {
        admissionNumber,
        patientId: patient.id,
        patientUniqueId: patient.patientId,
        bedId: bed.id,
        roomId: bed.roomId,
        wardId: bed.wardId,
        hospitalId,
        doctorId: attendingDoctorName === "doctor" ? doctor.id : null,
        subDoctorId: attendingDoctorName === "subDoctor" ? subDoctor.id : null,
        attendingDoctorName: resolvedDoctorName,
        department: resolvedDepartment,
        admissionReason: admissionReason.trim(),
        diagnosis: diagnosis?.trim() || null,
        clinicalStatus: clinicalStatus || "Stable",
        status: "transfer to ICU",
        admissionDate: admissionDateTime,
        advancePayment: parsedAdvance,
        type,
      },
      { transaction }
    );

    const accountNumber = await generateAccountNumber(
      IPDAccount,
      hospitalId,
      transaction
    );

    const account = await IPDAccount.create(
      {
        accountNumber,
        patientId: patient.id,
        patientUniqueId: patient.patientId,
        admissionId: admission.id,
        hospitalId,
        totalAmount: 0,
        discount: 0,
        advancePayment: parsedAdvance,
        paidAmount: parsedAdvance,
        remainingAmount: 0,
        paymentStatus:
          parsedAdvance > 0 ? "partial" : "pending",
        status: "open",
        remarks: `Account open for patient acc. ${accountNumber}`,
      },
      { transaction }
    );

    const icuAdmissionNumber = await createAdmissionSequence(
      ICUAdmission,
      "ICU-ADM",
      hospitalId,
      transaction
    );

    const icuAdmission = await ICUAdmission.create(
      {
        icuAdmissionNumber,
        hospitalId,
        patientId: patient.id,
        patientUniqueId: patient.patientId,
        ipdAdmissionId: admission.id,
        wardId: bed.wardId,
        roomId: bed.roomId,
        bedId: bed.id,
        admissionDate: admissionDateTime.toISOString().slice(0, 10),
        admissionTime: admissionDateTime.toTimeString().slice(0, 8),
        admissionType: admissionType ? admissionType : "DIRECT",
        admissionReason: admissionReason.trim(),
        diagnosis: diagnosis?.trim() || null,
        clinicalStatus: clinicalStatus || "Stable",
        attendingDoctorId: attendingDoctorName === "doctor" ? doctor.id : null,
        attendingSubDoctorId: attendingDoctorName === "subDoctor" ? subDoctor.id : null,
        status: "ACTIVE",
      },
      { transaction }
    );


    if (req.files?.length > 0) {
      console.log("req.files.length 1", req.files.length);
      const documents = req.files.map((file) => ({
        hospitalId,
        patientId: patient.id,
        patientUniqueId: patient.patientId,
        admissionId: admission.id,

        documentName: file.originalname,
        documentType: " MEDICAL",

        document: `data:${file.mimetype};base64,${file.buffer.toString(
          "base64"
        )}`,

        documentMimeType: file.mimetype,
      }));

      console.log("req.files.length 2", req.files.length);

      await PatientDocument.bulkCreate(documents, {
        transaction,
      });

      console.log("req.files.length 3", req.files.length);
    }

    await bed.update({ status: "occupied", patientId: patient.id }, { transaction });

    const bedRate = Number(bed.pricePerDay || 0);

    IPDAccountCharge.create(
      {
        accountId: account.id,

        chargeName: "Bed Charge",

        quantity: 1,

        unitPrice: bedRate,

        totalAmount: bedRate,

        chargeDate: admission.admissionDate,

        remarks: `ICU Bed charge for bed ${bed.bedCode} (${bed.id})`,
      },
      { transaction }
    );

    const remainingAmount = Math.max(
      0,
      bedRate - parsedAdvance
    );

    let paymentStatus = "pending";

    if (parsedAdvance >= bedRate && bedRate > 0) {
      paymentStatus = "paid";
    } else if (parsedAdvance > 0) {
      paymentStatus = "partial";
    }

    await account.update(
      {
        totalAmount: bedRate,
        paidAmount: parsedAdvance,
        remainingAmount,
        paymentStatus,
      },
      { transaction }
    );

    if (parsedAdvance > 0) {
      const paymentNumber = await generatePaymentId(IPDAccountPayment, transaction)

      await IPDAccountPayment.create(
        {
          accountId: account.id,
          paymentNumber,
          amount: parsedAdvance,
          paymentMode: "cash",
          paymentDate: new Date(),
          remarks: `Advance payment for patient account ${accountNumber}`,
          status: "completed",
        },
        { transaction }
      );
    }

    await auditMetadataOnly(req, "CREATE_IPD_ADMISSION", "IPDAdmission", admission.id, transaction);
    await transaction.commit();


    return res.status(201).json({
      success: true,
      message: "Patient admitted in ICU successfully",
    });
  } catch (error) {
    console.error("createAdmission error:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: error.message || "Failed to admit patient." });
  }
};

exports.getICUAdmissions = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const { searchTerm, doctorId, doctorType, admissionDate, status, admissionType } = req.query;
    const where = { hospitalId };
    const patientWhere = {};

    if (status && status !== "All") {
      where.status = status;
    } else {
      where.status = "ACTIVE";
    }

    if (admissionType && admissionType !== "All") {
      where.admissionType = admissionType;
    }

    if (doctorId && doctorType === "doctor") {
      where.attendingDoctorId = doctorId;
    }

    if (doctorId && doctorType === "subdoctor") {
      where.attendingSubDoctorId = doctorId;
    }

    if (admissionDate) {
      const start = new Date(admissionDate);
      const end = new Date(admissionDate);
      end.setDate(end.getDate() + 1);
      where.admissionDate = { [Op.gte]: start, [Op.lt]: end };
    }

    if (searchTerm) {
      const mapping = await getSearchMapping(hospitalId);

      const transformedSearch = transformWithMapping(searchTerm, mapping);

      patientWhere[Op.or] = [
        // { nameSearch: { [Op.like]: `%${transformedSearch}%` }},
        // { mobileSearch: { [Op.like]: `%${transformedSearch}%` }},
        { patientId: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const admissions = await ICUAdmission.findAll({
      where,
      include: [
        {
          model: IPDAdmission,
          as: "ipdAdmission",
          attributes: ["id", "admissionNumber"],
          include: [
            {
              model: IPDDischarge,
              as: "discharge",
              required: false,
              attributes: ["id", "status", "dischargeType"],
            },
          ],
        },
        {
          model: Patient,
          as: "patient",
          attributes: [
            "id",
            "name",
            "patientId",
            "mobileNumber",
            "age",
            "gender",
            "bloodGroup",
            "nameSearch",
            "mobileSearch",
          ],
          where: Object.keys(patientWhere).length
            ? patientWhere
            : undefined,
          required: !!searchTerm,
        },
        {
          model: Ward,
          as: "ward",
          attributes: ["id", "wardName", "wardType"],
        },
        {
          model: Room,
          as: "room",
          attributes: ["id", "roomNumber"],
        },
        {
          model: Bed,
          as: "bed",
          attributes: [
            "id",
            "bedCode",
            "bedType",
            "pricePerDay",
          ],
        },
        {
          model: Doctor,
          as: "attendingDoctor",
          attributes: ["id", "name", "email", "department"],
        },

        {
          model: SubDoctor,
          as: "attendingSubDoctor",
          attributes: ["id", "name", "email", "department"],
        },
      ],
      order: [["admissionDate", "DESC"]],
    });

    const doctor = await Doctor.findOne({
      where: {
        id: hospitalId,
      },
      attributes: ["logo", "logoContentType"],
    });

    const logo = doctor?.logo
      ? getDecryptedDocumentAsBase64(doctor.logo)
      : null;


    return res.status(200).json({
      success: true,
      admissions: admissions.map((admission) =>
        formatAdmission(admission, logo)
      ),
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ success: false, message: "Failed to get admissions." });
  }
};

exports.initiateICUDischarge = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const hospitalId = getHospitalId(req);

    const {
      admissionId,
      dischargeType,
      dischargeCondition,
      followUpDate,
      followUpInstructions,
      dischargeNote,
      dischargeDate,
      dischargeTime,
    } = req.body;

    if (!admissionId || !dischargeType || !dischargeCondition) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Admission, discharge type, and discharge condition are required.",
      });
    }

    const admission = await ICUAdmission.findOne({
      where: {
        id: admissionId,
        hospitalId,
      },
      transaction,
    });

    if (!admission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Admission not found.",
      });
    }

    if (admission.status !== "ACTIVE") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Discharge can only be initiated for an admitted active patient.",
      });
    }

    const ipdAdmission = await IPDAdmission.findOne({
      where: {
        id: admission.ipdAdmissionId,
        hospitalId,
      },
      transaction,
    });

    if (!ipdAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Linked IPD admission not found.",
      });
    }

    const existingDischarge = await IPDDischarge.findOne({
      where: {
        admissionId: ipdAdmission.id,
        hospitalId,
      },
      transaction,
    });

    if (existingDischarge) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Discharge already exists for this admission.",
      });
    }

    const dischargeId = await createSequence(
      IPDDischarge,
      "DC",
      hospitalId,
      transaction
    );

    const discharge = await IPDDischarge.create(
      {
        dischargeId,
        admissionId: ipdAdmission.id,
        patientId: admission.patientId,
        hospitalId,

        dischargeNote: dischargeNote?.trim() || null,

        dischargeInitiateDate: new Date(),

        dischargeDate: dischargeDate,
        dischargeTime: dischargeTime || null,

        dischargeType,
        dischargeCondition,

        followUpDate: followUpDate || null,
        followUpInstructions:
          followUpInstructions?.trim() || null,

        finalBill: 0,

        status: "Initiated",
      },
      { transaction }
    );

    await admission.update(
      {
        status: "DISCHARGE_INITIATED",
      },
      {
        transaction,
      }
    );

    await ipdAdmission.update(
      {
        status: "discharge Initiated",
      },
      {
        transaction,
      }
    );

    await auditMetadataOnly(
      req,
      "CREATE_ICU_DISCHARGE",
      "IPDDischarge",
      discharge.id,
      transaction
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "ICU Discharge initiated successfully.",
      // discharge,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Create discharge error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to initiate discharge.",
    });
  }
};

exports.completeDischarge = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const hospitalId = getHospitalId(req);
    const { dischargeId } = req.params;

    if (!hospitalId) {
      await transaction.rollback();

      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    if (!dischargeId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Discharge ID is required.",
      });
    }

    const discharge = await IPDDischarge.findOne({
      where: {
        id: dischargeId,
        hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!discharge) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Discharge record not found.",
      });
    }

    if (discharge.status === "Discharged") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Discharge is already completed.",
      });
    }

    if (discharge.status === "Cancelled") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Cancelled discharge cannot be completed.",
      });
    }

    if (discharge.status !== "Initiated") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: `Discharge cannot be completed from ${discharge.status} status & Discharge not initiated yet.`,
      });
    }

    const admission = await IPDAdmission.findOne({
      where: {
        id: discharge.admissionId,
        hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!admission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Admission not found.",
      });
    }

    if (admission.status !== "admitted" && admission.status !== "discharge Initiated") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Only an admitted or discharge Initiated patient can be discharged.",
      });
    }

    const ipdAdmissionId = discharge.admissionId || admission.id;

    const icuAdmission = await ICUAdmission.findOne({
      where: {
        ipdAdmissionId,
        hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!icuAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "ICU Admission not found.",
      });
    }

    const account = await IPDAccount.findOne({
      where: {
        admissionId: admission.id,
        hospitalId,
      },
      include: [
        {
          model: IPDAccountCharge,
          as: "charges",
          required: false,
        },
        {
          model: IPDAccountPayment,
          as: "payments",
          required: false,
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!account) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "IPD account not found.",
      });
    }

    const totalAmount =
      account.charges?.reduce(
        (total, charge) => total + Number(charge.totalAmount || 0),
        0
      ) || 0;

    const paidAmount =
      account.payments?.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      ) || 0;

    const discount = Number(account.discount || 0);

    const netAmount = Math.max(totalAmount - discount, 0);

    const remainingAmount = Math.max(
      netAmount - paidAmount,
      0
    );

    let paymentStatus = "pending";

    if (paidAmount <= 0) {
      paymentStatus = "pending";
    } else if (remainingAmount <= 0) {
      paymentStatus = "paid";
    } else {
      paymentStatus = "partial";
    }

    if (paymentStatus !== "paid" || remainingAmount > 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: `Cannot complete discharge. Please clear the pending amount, And remaining amount is ${remainingAmount}`,
      });
    }

    const now = new Date();

    const dischargeDate = now.toISOString().split("T")[0];

    const dischargeTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    const followUpDate = discharge.followUpDate
      ? discharge.followUpDate
      : new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

    await discharge.update(
      {
        dischargeDate,
        dischargeTime,
        followUpDate,
        finalBill: netAmount,
        followUpInstructions:
          discharge?.followUpInstructions ||
          "Follow up after 8 days or as advised by the doctor. Continue medications and follow all recommended precautions.",
        status: "Discharged",
      },
      {
        transaction,
      }
    );

    await account.update(
      {
        totalAmount: totalAmount,
        discount: discount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        paymentStatus: "paid",
        status: "closed",
        closedAt: now,
      },
      {
        transaction,
      }
    );

    await admission.update(
      {
        dischargedAt: now,
        status: "discharged",
      },
      {
        transaction,
      }
    );

    await icuAdmission.update(
      {
        dischargeDate: now.toISOString().split("T")[0],
        dischargeTime: now.toTimeString().split(" ")[0],
        status: "DISCHARGED",
      },
      {
        transaction,
      }
    );

    if (admission.bedId) {
      const bed = await Bed.findOne({
        where: {
          id: admission.bedId,
          doctorId: hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (bed) {
        await bed.update(
          {
            status: "available",
          },
          {
            transaction,
          }
        );
      }
    }

    await auditMetadataOnly(
      req,
      "COMPLETE_ICU_DISCHARGE",
      "IPDDischarge",
      discharge.id,
      transaction
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Discharge completed successfully.",

    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Complete discharge error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete discharge.",
      error: error.message,
    });
  }
};

// exports.transferICUToOPD = async (req, res) => {
//     const transaction = await sequelize.transaction();
//     try {
//         const doctorId = getHospitalId(req);
//         const { admissionId, toBedId, reason, transferredAt } = req.body;

//         if (!admissionId || !toBedId || !reason?.trim()) {
//           await transaction.rollback();
//           return res.status(400).json({
//             success: false,
//             message: "Admission, new bed, and transfer reason are required.",
//           });
//         }

//         const icuAdmission = await icuAdmission.findOne({
//             where: { 
//                 id: admissionId, 
//                 hospitalId:doctorId, 
//                 status: "ACTIVE" 
//             },
//             transaction,
//         });

//         if (!icuAdmission) {
//             await transaction.rollback();
//             return res.status(404).json({ success: false, message: "ICU Active admission not found to transfer bed." });
//         }

//         const account = await IPDAccount.findOne({
//             where: {
//                 admissionId: icuAdmission.ipdAdmissionId,
//                 hospitalId: doctorId,
//                 status: "open",
//             },
//             transaction,
//         });

//         if (!account) {
//             await transaction.rollback();

//             return res.status(404).json({
//                 success: false,
//                 message: "Open IPD account not found, So can not transfer bed.",
//             });
//         }

//         const [fromBed, toBed] = await Promise.all([
//             Bed.findOne({ 
//                 where: { 
//                     id: icuAdmission.bedId, 
//                     doctorId 
//                 }, 
//                 transaction 
//             }),
//             Bed.findOne({ 
//                 where: { 
//                     id: toBedId, 
//                     doctorId 
//                 }, 
//                 transaction 
//             }),
//         ]);

//         const ward = await Ward.findOne({
//             where: {
//                 id: toBed.wardId,
//                 doctorId,
//             },
//             transaction,
//         });

//         if (!ward) {
//         await transaction.rollback();

//         return res.status(404).json({
//             success: false,
//             message: "Destination ward not found.",
//         });
//         }

//         if (ward.wardType === "ICU") {
//             await transaction.rollback();

//             return res.status(400).json({
//                 success: false,
//                 message: "Selected bed belong to an ICU ward. Select other bed",
//             });
//         }

//         if (!toBed || !["available", "discharged"].includes(toBed.status)) {
//             await transaction.rollback();
//             return res.status(400).json({ success: false, message: "Selected bed is not available." });
//         }

//         if (Number(toBed.id) === Number(fromBed?.id)) {
//             await transaction.rollback();
//             return res.status(400).json({ success: false, message: "Select a different bed." });
//         }

//         const transferDate = transferredAt
//         ? new Date(transferredAt)
//         : new Date();

//         if (Number.isNaN(transferDate.getTime())) {
//             await transaction.rollback();

//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid transfer date.",
//             });
//         }

//         const currentBedCharge = await IPDAccountCharge.findOne({
//             where: {
//                 accountId: account.id,
//                 chargeName: "Bed Charge",
//                 isActive: true,
//             },
//             order: [["id", "DESC"]],
//             transaction,
//         });

//         if (!currentBedCharge) {
//             await transaction.rollback();

//             return res.status(404).json({
//                 success: false,
//                 message: "Active bed not found, So can not transfer to new bed.",
//             });
//         }

//         const ipdAdmission = await IPDAdmission.findOne({
//               where: { 
//                 patientId: icuAdmission.patientId, 
//                 hospitalId:doctorId, 
//                 status: "transfer to ICU",
//             },
//               transaction,
//         });

//         if (!ipdAdmission) {
//             await transaction.rollback();
//             return res.status(404).json({ success: false, message: "Ipd admission not found" });
//         }

//         const chargeStartDate = new Date(
//             currentBedCharge.chargeDate
//         );

//         const oldStartDate = new Date(
//             chargeStartDate.getFullYear(),
//             chargeStartDate.getMonth(),
//             chargeStartDate.getDate()
//         );

//         const newTransferDate = new Date(
//             transferDate.getFullYear(),
//             transferDate.getMonth(),
//             transferDate.getDate()
//         );

//         const DAY_MS = 1000 * 60 * 60 * 24;

//         const oldBedDays = Math.max(
//         1,
//         Math.floor(
//             (newTransferDate.getTime() -
//             oldStartDate.getTime()) /
//             DAY_MS
//         ) + 1
//         );

//         const oldUnitPrice = Number(
//         currentBedCharge.unitPrice || 0
//         );

//         const oldTotalAmount = Number(
//         (oldBedDays * oldUnitPrice).toFixed(2)
//         );

//         await currentBedCharge.update(
//         {
//             quantity: oldBedDays,
//             totalAmount: oldTotalAmount,
//             isActive: false,
//         },
//         {
//             transaction,
//         }
//         );

//         const newUnitPrice = Number(
//             toBed.pricePerDay || 0
//         );

//         await IPDAccountCharge.create(
//             {
//                 accountId: account.id,
//                 chargeName: "Bed Charge",
//                 quantity: 1,
//                 unitPrice: newUnitPrice,
//                 totalAmount: newUnitPrice,
//                 chargeDate: transferDate,
//                 remarks: `ICU to TPD transfer charge for bed ${toBed.bedCode || toBed.id} (${toBed.id}) (${ward.wardType})`,
//                 isActive: true,
//             },
//             {
//                 transaction,
//             }
//         );

//         const charges = await IPDAccountCharge.findAll({
//           where: {
//             accountId: account.id,
//           },
//           transaction,
//         });

//         const totalAmount = charges.reduce(
//             (sum, charge) =>
//             sum + Number(charge.totalAmount || 0),
//             0
//         );

//         const paidAmount = Number(account.paidAmount || 0);

//         const discount = Number(account.discount || 0);

//         const netAmount = Math.max(0,totalAmount - discount);

//         const remainingAmount = Math.max(0,netAmount - paidAmount);

//         let paymentStatus = "pending";

//         if (paidAmount >= netAmount && netAmount > 0
//         ) {
//             paymentStatus = "paid";
//         } else if (paidAmount > 0) {
//             paymentStatus = "partial";
//         }

//         await account.update(
//             {
//                 totalAmount,
//                 remainingAmount,
//                 paymentStatus,
//             },
//             {
//                 transaction,
//             }
//         );

//         const transferNumber = await createBedSequence(
//             BedTransfer,
//             "TRF",
//             doctorId,
//             transaction
//         );

//         const transfer = await BedTransfer.create(
//             {
//                 transferNumber,
//                 admissionId: ipdAdmission.id,
//                 patientId: ipdAdmission.patientId,
//                 fromWardId: icuAdmission.wardId,
//                 fromRoomId: icuAdmission.roomId,
//                 fromBedId: icuAdmission.bedId,
//                 toWardId: toBed.wardId,
//                 toRoomId: toBed.roomId,
//                 toBedId: toBed.id,
//                 fromBedChargePerDay: Number(fromBed?.pricePerDay || 0),
//                 toBedChargePerDay: Number(toBed.pricePerDay || 0),
//                 doctorId,
//                 reason: reason.trim(),
//                 transferredAt: transferDate,
//             },
//             { transaction }
//         );

//         if (fromBed) {
//             await fromBed.update({ status: "available", patientId: null }, { transaction });
//         }

//         await toBed.update({ status: "occupied", patientId: ipdAdmission.patientId }, { transaction });

//         await ipdAdmission.update(
//             { 
//                 wardId: toBed.wardId, 
//                 roomId: toBed.roomId, 
//                 bedId: toBed.id,
//                 status: "admitted", 
//                 clinicalStatus:"Under Treatment",
//             },
//             { transaction }
//         );

//         await icuAdmission.update(
//           {
//             clinicalStatus:"Patinet is stable, Now transfer to IPD",
//             status: "TRANSFERRED_TO_IPD",
//           },
//           { transaction }
//         );

//         await auditMetadataOnly(req, "TRANSFER_ICU_BED_TO_IPD", "BedTransfer", transfer.id, transaction);

//         await transaction.commit();

//         return res.status(201).json({
//             success: true,
//             message: "Patient transferred to IPD successfully",
//         });


//     } catch (error) {
//         console.error("Bed transfer error:", error);
//         if (transaction && !transaction.finished) await transaction.rollback();
//         return res.status(500).json({ success: false, message: "Failed to transfer to IPD." });
//     }
// };

exports.transferICUToIPD = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const hospitalId = getHospitalId(req);

    const {
      admissionId,
      toBedId,
      reason,
      transferredAt,
    } = req.body;

    if (!hospitalId) {
      await transaction.rollback();

      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    if (!admissionId || !toBedId || !reason?.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Admission, new bed, and transfer reason are required.",
      });
    }

    const currentICUAdmission = await ICUAdmission.findOne({
      where: {
        id: admissionId,
        hospitalId,
        status: "ACTIVE",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!currentICUAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Active ICU admission not found to transfer patient.",
      });
    }

    const ipdAdmission = await IPDAdmission.findOne({
      where: {
        id: currentICUAdmission.ipdAdmissionId,
        hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!ipdAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Related IPD admission not found.",
      });
    }

    const account = await IPDAccount.findOne({
      where: {
        admissionId: ipdAdmission.id,
        hospitalId,
        status: "open",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!account) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Open IPD account not found, so patient cannot be transferred.",
      });
    }

    const fromBed = await Bed.findOne({
      where: {
        id: currentICUAdmission.bedId,
        doctorId: hospitalId,
      },
      transaction,
    });

    if (!fromBed) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Current ICU bed not found.",
      });
    }

    const toBed = await Bed.findOne({
      where: {
        id: toBedId,
        doctorId: hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!toBed) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Destination bed not found.",
      });
    }

    if (Number(toBed.id) === Number(fromBed.id)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Select a different bed.",
      });
    }

    if (!["available", "discharged"].includes(toBed.status)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Selected bed is not available.",
      });
    }

    const ward = await Ward.findOne({
      where: {
        id: toBed.wardId,
        doctorId: hospitalId,
      },
      transaction,
    });

    if (!ward) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Destination ward not found.",
      });
    }

    if (ward.wardType === "ICU") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Selected bed belongs to an ICU ward. Please select an IPD/general ward bed.",
      });
    }

    const transferDate = transferredAt
      ? new Date(transferredAt)
      : new Date();

    if (Number.isNaN(transferDate.getTime())) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Invalid transfer date.",
      });
    }

    const currentBedCharge = await IPDAccountCharge.findOne({
      where: {
        accountId: account.id,
        chargeName: "Bed Charge",
        isActive: true,
      },
      order: [["id", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!currentBedCharge) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message:
          "Active bed charge not found, so patient cannot be transferred.",
      });
    }


    const chargeStartDate = new Date(
      currentBedCharge.chargeDate
    );

    const oldStartDate = new Date(
      chargeStartDate.getFullYear(),
      chargeStartDate.getMonth(),
      chargeStartDate.getDate()
    );

    const newTransferDate = new Date(
      transferDate.getFullYear(),
      transferDate.getMonth(),
      transferDate.getDate()
    );

    const DAY_MS = 1000 * 60 * 60 * 24;

    const oldBedDays = Math.max(
      1,
      Math.floor(
        (newTransferDate.getTime() -
          oldStartDate.getTime()) /
        DAY_MS
      ) + 1
    );

    const oldUnitPrice = Number(
      currentBedCharge.unitPrice || 0
    );

    const oldTotalAmount = Number(
      (oldBedDays * oldUnitPrice).toFixed(2)
    );

    await currentBedCharge.update(
      {
        quantity: oldBedDays,
        totalAmount: oldTotalAmount,
        isActive: false,
      },
      {
        transaction,
      }
    );


    const newUnitPrice = Number(
      toBed.pricePerDay || 0
    );

    await IPDAccountCharge.create(
      {
        accountId: account.id,
        chargeName: "Bed Charge",
        quantity: 1,
        unitPrice: newUnitPrice,
        totalAmount: newUnitPrice,
        chargeDate: transferDate,
        remarks: `ICU to IPD transfer charge for bed ${toBed.bedCode || toBed.id
          } (${ward.wardType})`,
        isActive: true,
      },
      {
        transaction,
      }
    );


    const charges = await IPDAccountCharge.findAll({
      where: {
        accountId: account.id,
      },
      transaction,
    });

    const totalAmount = charges.reduce(
      (sum, charge) =>
        sum + Number(charge.totalAmount || 0),
      0
    );

    const paidAmount = Number(account.paidAmount || 0);

    const discount = Number(account.discount || 0);

    const netAmount = Math.max(0, totalAmount - discount);

    const remainingAmount = Math.max(0, netAmount - paidAmount);

    let paymentStatus = "pending";

    if (netAmount === 0) {
      paymentStatus = "paid";
    } else if (paidAmount >= netAmount) {
      paymentStatus = "paid";
    } else if (paidAmount > 0) {
      paymentStatus = "partial";
    }

    await account.update(
      {
        totalAmount,
        remainingAmount,
        paymentStatus,
      },
      {
        transaction,
      }
    );


    const transferNumber = await createBedSequence(
      BedTransfer,
      "TRF",
      hospitalId,
      transaction
    );

    const transfer = await BedTransfer.create(
      {
        transferNumber,

        admissionId: ipdAdmission.id,
        patientId: ipdAdmission.patientId,

        fromWardId: currentICUAdmission.wardId,
        fromRoomId: currentICUAdmission.roomId,
        fromBedId: currentICUAdmission.bedId,

        toWardId: toBed.wardId,
        toRoomId: toBed.roomId,
        toBedId: toBed.id,

        fromBedChargePerDay: Number(
          fromBed.pricePerDay || 0
        ),

        toBedChargePerDay: Number(
          toBed.pricePerDay || 0
        ),

        doctorId: hospitalId,

        reason: reason.trim(),

        transferredAt: transferDate,
      },
      {
        transaction,
      }
    );

    await fromBed.update(
      {
        status: "available",
        patientId: null,
      },
      {
        transaction,
      }
    );

    await toBed.update(
      {
        status: "occupied",
        patientId: ipdAdmission.patientId,
      },
      {
        transaction,
      }
    );

    await ipdAdmission.update(
      {
        wardId: toBed.wardId,
        roomId: toBed.roomId,
        bedId: toBed.id,

        status: "admitted",

        clinicalStatus: "Stable",
      },
      {
        transaction,
      }
    );

    await currentICUAdmission.update(
      {
        status: "TRANSFERRED_TO_IPD",
        clinicalStatus: "Patinet is stable, Now transfer to IPD",
      },
      {
        transaction,
      }
    );

    await auditMetadataOnly(
      req,
      "TRANSFER_ICU_TO_IPD",
      "BedTransfer",
      transfer.id,
      transaction
    );


    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Patient transferred from ICU to IPD successfully.",
    });
  } catch (error) {
    console.error("ICU to IPD transfer error:", error);

    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(500).json({
      success: false,
      message: "Failed to transfer patient from ICU to IPD.",
      error: error.message,
    });
  }
};

exports.transferICUPatientToOtherHospital = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const hospitalId = getHospitalId(req);

    const {
      admissionId,
      reason,
    } = req.body;

    if (!admissionId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "ICU admissionId is required.",
      });
    }

    if (!reason || !reason.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Transfer reason is required.",
      });
    }

    const currentICUAdmission = await ICUAdmission.findOne({
      where: {
        id: admissionId,
        hospitalId,
        status: "ACTIVE",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!currentICUAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Active ICU admission not found.",
      });
    }

    if (!currentICUAdmission.ipdAdmissionId) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "This ICU admission is not linked to an IPD admission.",
      });
    }

    const ipdAdmission = await IPDAdmission.findOne({
      where: {
        id: currentICUAdmission.ipdAdmissionId,
        hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!ipdAdmission) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Linked IPD admission not found.",
      });
    }

    if (
      ipdAdmission.status !== "transfer to ICU"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: `IPD admission cannot be transferred from ${ipdAdmission.status} status.`,
      });
    }

    if (
      ipdAdmission.status === "discharged" || ipdAdmission.status === "discharge Initiated"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: `IPD admission allready ${ipdAdmission.status}, So cannot tranfer.`,
      });
    }

    const ipdAccount = await IPDAccount.findOne({
      where: {
        admissionId: ipdAdmission.id,
        hospitalId,
        status: "open",
      },
      include: [
        {
          model: IPDAccountCharge,
          as: "charges",
          required: false,
        },
        {
          model: IPDPayment,
          as: "payments",
          required: false,
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!ipdAccount) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Open IPD account not found.",
      });
    }

    const totalCharges = (ipdAccount.charges || []).reduce(
      (sum, charge) => {
        return sum + Number(charge.totalAmount || 0);
      },
      0
    );

    const totalPaid = (ipdAccount.payments || []).reduce(
      (sum, payment) => {
        return sum + Number(payment.amount || 0);
      },
      0
    );

    const discount = Number(ipdAccount.discount || 0);

    const netAmount = Math.max(
      totalCharges - discount,
      0
    );

    const remainingAmount = Math.max(
      netAmount - totalPaid,
      0
    );

    if (remainingAmount > 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: `Cannot complete transfer. Please clear the pending amount, And remaining amount is ${remainingAmount}`,
      });
    }

    if (totalPaid > netAmount) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Paid amount is greater than the final bill. Please verify the payments before transfer.",
        data: {
          totalCharges,
          discount,
          netAmount,
          totalPaid,
        },
      });
    }

    const currentBed = await Bed.findOne({
      where: {
        id: currentICUAdmission.bedId,
        hospitalId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!currentBed) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Current ICU bed not found.",
      });
    }

    const dischargeId = await createSequence(
      IPDDischarge,
      "DC",
      hospitalId,
      transaction
    );

    const now = new Date();

    await IPDDischarge.create(
      {
        dischargeId,
        admissionId: ipdAdmission.id,
        patientId: ipdAdmission.patientId,
        hospitalId,

        dischargeNote: `Patient transferred. Reason: ${reason.trim()}`,

        dischargeInitiateDate: now.toISOString().split("T")[0],

        dischargeDate: now.toISOString().split("T")[0],
        dischargeTime: now.toTimeString().split(" ")[0],

        dischargeType: "Transfer",

        finalBill: netAmount,

        status: "Discharged",
      },
      { transaction }
    );

    await ipdAccount.update(
      {
        totalAmount: totalCharges,
        discount,
        paidAmount: totalPaid,
        remainingAmount: 0,
        paymentStatus: "paid",
        status: "closed",
        closedAt: now,
      },
      {
        transaction,
      }
    );

    await ipdAdmission.update(
      {
        status: "discharged",
        clinicalStatus: "Discharged",
        dischargedAt: now,
      },
      {
        transaction,
      }
    );

    await currentICUAdmission.update(
      {
        status: "TRANSFERRED",
        dischargeDate: now.toISOString().split("T")[0],
        dischargeTime: now.toTimeString().split(" ")[0],
      },
      {
        transaction,
      }
    );

    await currentBed.update(
      {
        status: "available",
        patientId: null,
      },
      {
        transaction,
      }
    );


    await auditMetadataOnly(
      req,
      "TRANSFER_ICU_PATIENT",
      "ICUAdmission",
      currentICUAdmission.id,
      transaction
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message:
        "Patient successfully transferred.",
    });
  } catch (error) {

    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error(
      "Transfer ICU patient to other hospital error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to transfer patient to another hospital.",
      error: error.message,
    });
  }
};

exports.getICUAdmissionByPatientId = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required.",
      });
    }

    const admission = await ICUAdmission.findOne({
      where: {
        hospitalId,
      },
      include: [
        {
          model: Patient,
          as: "patient",
          where: {
            patientId,
          },
          required: true,
          attributes: [
            "id",
            "name",
            "patientId",
            "mobileNumber",
            "age",
            "gender",
            "bloodGroup",
            "address",
            "dateOfBirth",
            "email",
          ],
        },

        {
          model: IPDAdmission,
          as: "ipdAdmission",
          attributes: [
            "id",
            "admissionNumber",
            "type",
            "status"
          ],
          include: [
            {
              model: IPDDischarge,
              as: "discharge",
              attributes: [
                "id",
                "dischargeDate",
                "dischargeTime",
                "dischargeType",
                "status",
              ],
            },
          ],
        },

        {
          model: Ward,
          as: "ward",
          attributes: [
            "id",
            "wardName",
            "wardType",
          ],
        },

        {
          model: Room,
          as: "room",
          attributes: [
            "id",
            "roomNumber",
          ],
        },

        {
          model: Bed,
          as: "bed",
          attributes: [
            "id",
            "bedCode",
            "bedType",
            "pricePerDay",
          ],
        },

        {
          model: Doctor,
          as: "attendingDoctor",
          attributes: [
            "id",
            "name",
            "email",
            "mobileNumber",
            "department",
          ],
        },

        {
          model: SubDoctor,
          as: "attendingSubDoctor",
          attributes: [
            "id",
            "name",
            "email",
            "mobileNumber",
            "department",
          ],
        },
      ],

      order: [
        ["admissionDate", "DESC"],
      ],
    });

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: "No ICU admission found for this patient.",
      });
    }

    const patient = admission.patient;
    const doctor = admission.attendingDoctor;
    const subDoctor = admission.attendingSubDoctor;

    const formattedPatient = patient
      ? {
        id: patient.id,
        patientId: patient.patientId,
        name: decrypt(patient.name),
        mobileNumber: decrypt(patient.mobileNumber),
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        address: decrypt(patient.address),
        dateOfBirth: patient.dateOfBirth,
        email: decrypt(patient.email),
      }
      : null;


    const formattedDoctor = doctor
      ? {
        id: doctor.id,
        name: decrypt(doctor.name),
        email: doctor.email,
        mobileNumber: decrypt(doctor.mobileNumber),
        department: doctor.department,
        type: "doctor",
      }
      : {
        id: subDoctor.id,
        name: decrypt(subDoctor.name),
        email: subDoctor.email,
        mobileNumber: decrypt(subDoctor.mobileNumber),
        department: subDoctor.department,
        type: "subDoctor",
      };


    const formattedWard = admission.ward
      ? {
        id: admission.ward.id,
        wardName: admission.ward.wardName,
        wardType: admission.ward.wardType,
      }
      : null;


    const formattedRoom = admission.room
      ? {
        id: admission.room.id,
        roomNumber: admission.room.roomNumber,
      }
      : null;



    const formattedBed = admission.bed
      ? {
        id: admission.bed.id,
        bedCode: admission.bed.bedCode,
        bedType: admission.bed.bedType,
        pricePerDay: admission.bed.pricePerDay,
      }
      : null;

    const discharge = admission?.ipdAdmission?.discharge || {};

    const formattedAdmission = {
      id: admission.id,
      icuAdmissionNumber: admission.icuAdmissionNumber,
      ipdAdmissionId: admission.ipdAdmissionId,
      admissionReason: admission.admissionReason,

      admissionStatus: admission.ipdAdmission ? admission.ipdAdmission.status : null,
      patient: formattedPatient,

      ipdAdmission: admission.ipdAdmission
        ? {
          id: admission.ipdAdmission.id,
          admissionNumber:
            admission.ipdAdmission.admissionNumber,
          type: admission.ipdAdmission.type,
          status: admission.ipdAdmission.status,
        }
        : null,

      ward: formattedWard,
      room: formattedRoom,
      bed: formattedBed,

      doctorData: formattedDoctor,

      admissionDate: admission.admissionDate,
      admissionTime: admission.admissionTime,
      admissionType: admission.ipdAdmission ? admission.ipdAdmission.type : null,
      icuAdmissionType: admission.admissionType,

      status: admission.status,
      dischargeDate: admission.dischargeDate ?? null,
      dischargeTime: admission.dischargeTime ?? null,
      discharge,
    };

    return res.status(200).json({
      success: true,
      admission: formattedAdmission,
    });
  } catch (error) {
    console.error(
      "Get ICU admission by patientId error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get ICU admission details.",
    });
  }
};







