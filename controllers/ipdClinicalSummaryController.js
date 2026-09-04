const { IPDAdmission, IPDClinicalSummary, Doctor, SubDoctor, AuditLog, sequelize } = require("../models");
const { decrypt } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId || req.user?.id;

const formatTimestamp = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

const decryptName = (name) => {
  if (!name) return "";
  if (!/^[0-9a-f]{32}:[0-9a-f]+$/i.test(name)) return name;
  try {
    return decrypt(name);
  } catch (err) {
    return name;
  }
};

const auditMetadataOnly = async (req, action, entity, entityId, transaction) => {
  if (!AuditLog) return;

  await AuditLog.create(
    {
      action,
      details: `${action} ${entity} record`,
      hospitalId: getHospitalId(req),
      receptionistId: req.user.role === "receptionist" ? req.user.id : null,
      doctorId: req.user.role === "doctor" ? req.user.id : null,
      subDoctorId: req.user.role === "subDoctor" ? req.user.id : null,
      role: req.user.role,
      token: req.header("Authorization")?.split(" ")[1],
      entity,
      entityId,
      oldValue: null,
      newValue: null,
      status: "success",
      endpoint: req.originalUrl,
      ipAddress: req.clientIp,
      userAgent: req.headers["user-agent"],
    },
    { transaction }
  );
};

const resolveDoctorName = async (hospitalId, attendingDoctorId, attendingDoctorType, transaction) => {
  if (attendingDoctorType === "subDoctor") {
    const subDoctor = await SubDoctor.findOne({
      where: { id: attendingDoctorId, addedBy: hospitalId },
      attributes: ["name"],
      transaction,
    });
    return subDoctor?.name ? decryptName(subDoctor.name) : "";
  }

  const doctor = await Doctor.findByPk(hospitalId, { attributes: ["name"], transaction });
  return doctor?.name || "";
};

const resolveDoctorNames = async (hospitalId, sections) => {
  const subDoctorIds = Array.from(
    new Set(
      sections
        .filter((s) => s.attendingDoctorType === "subDoctor")
        .map((s) => s.attendingDoctorId)
    )
  );

  const needsPrimaryDoctor = sections.some((s) => s.attendingDoctorType === "doctor");

  const [subDoctors, primaryDoctor] = await Promise.all([
    subDoctorIds.length
      ? SubDoctor.findAll({ where: { id: subDoctorIds }, attributes: ["id", "name"] })
      : Promise.resolve([]),
    needsPrimaryDoctor
      ? Doctor.findByPk(hospitalId, { attributes: ["id", "name"] })
      : Promise.resolve(null),
  ]);

  const subDoctorMap = new Map(
    subDoctors.map((d) => [d.id, decryptName(d.toJSON().name)])
  );

  return (attendingDoctorId, attendingDoctorType) => {
    if (attendingDoctorType === "subDoctor") return subDoctorMap.get(attendingDoctorId) || "";
    return primaryDoctor?.toJSON().name || "";
  };
};

const formatSection = (section, doctorName) => {
  const item = section.toJSON();
  return {
    id: item.id,
    admissionId: item.admissionId,
    heading: item.heading,
    description: item.description,
    status: item.status,
    date: item.date,
    doctorId: item.attendingDoctorId,
    doctorType: item.attendingDoctorType,
    doctorName,
    timestamp: formatTimestamp(item.createdAt),
  };
};

exports.getSections = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { admissionId } = req.params;

    const admission = await IPDAdmission.findOne({ where: { id: admissionId, doctorId } });
    if (!admission) {
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    const sections = await IPDClinicalSummary.findAll({
      where: { admissionId, doctorId },
      order: [["createdAt", "DESC"]],
    });

    const getDoctorName = await resolveDoctorNames(doctorId, sections);

    return res.status(200).json({
      success: true,
      sections: sections.map((s) =>
        formatSection(s, getDoctorName(s.attendingDoctorId, s.attendingDoctorType))
      ),
    });
  } catch (error) {
    console.error("getSections failed:", error);
    return res.status(500).json({ success: false, message: "Failed to get clinical summary." });
  }
};

exports.createSection = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const { admissionId } = req.params;
    const {
      heading,
      description,
      status = "Stable",
      doctorId: attendingDoctorId,
      doctorType: attendingDoctorType = "doctor",
      date,
    } = req.body;

    if (!heading?.trim() || !description?.trim() || !attendingDoctorId || !date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Doctor, date, heading and description are required.",
      });
    }

    const admission = await IPDAdmission.findOne({ where: { id: admissionId, doctorId }, transaction });
    if (!admission) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Admission not found." });
    }

    const section = await IPDClinicalSummary.create(
      {
        admissionId: admission.id,
        patientId: admission.patientId,
        doctorId,
        attendingDoctorId,
        attendingDoctorType,
        date,
        heading: heading.trim(),
        description: description.trim(),
        status,
      },
      { transaction }
    );

    const attendingDoctorName = await resolveDoctorName(doctorId, attendingDoctorId, attendingDoctorType, transaction);

    await auditMetadataOnly(req, "CREATE_CLINICAL_SUMMARY", "IPDClinicalSummary", section.id, transaction);
    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Section added successfully",
      section: formatSection(section, attendingDoctorName),
    });
  } catch (error) {
    console.error("createSection failed:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to add section." });
  }
};

exports.updateSection = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const { id } = req.params;
    const {
      heading,
      description,
      status,
      doctorId: attendingDoctorId,
      doctorType: attendingDoctorType = "doctor",
      date,
    } = req.body;

    if (!heading?.trim() || !description?.trim() || !attendingDoctorId || !date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Doctor, date, heading and description are required.",
      });
    }

    const section = await IPDClinicalSummary.findOne({ where: { id, doctorId }, transaction });
    if (!section) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Section not found." });
    }

    await section.update(
      {
        heading: heading.trim(),
        description: description.trim(),
        status: status || section.status,
        attendingDoctorId,
        attendingDoctorType,
        date,
      },
      { transaction }
    );

    const attendingDoctorName = await resolveDoctorName(doctorId, attendingDoctorId, attendingDoctorType, transaction);

    await auditMetadataOnly(req, "UPDATE_CLINICAL_SUMMARY", "IPDClinicalSummary", section.id, transaction);
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Section updated successfully",
      section: formatSection(section, attendingDoctorName),
    });
  } catch (error) {
    console.error("updateSection failed:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to update section." });
  }
};

exports.deleteSection = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const { id } = req.params;

    const section = await IPDClinicalSummary.findOne({ where: { id, doctorId }, transaction });
    if (!section) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Section not found." });
    }

    await section.destroy({ transaction });
    await auditMetadataOnly(req, "DELETE_CLINICAL_SUMMARY", "IPDClinicalSummary", id, transaction);
    await transaction.commit();

    return res.status(200).json({ success: true, message: "Section deleted successfully" });
  } catch (error) {
    console.error("deleteSection failed:", error);
    if (transaction && !transaction.finished) await transaction.rollback();
    return res.status(500).json({ success: false, message: "Failed to delete section." });
  }
};

exports.getDoctors = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const [primaryDoctor, subDoctors] = await Promise.all([
      Doctor.findByPk(hospitalId, { attributes: ["id", "name", "specialization"] }),
      SubDoctor.findAll({
        where: { addedBy: hospitalId, isActive: true },
        attributes: ["id", "name", "specialization"],
        order: [["name", "ASC"]],
      }),
    ]);

    const doctors = [];

    if (primaryDoctor) {
      const json = primaryDoctor.toJSON();
      doctors.push({
        id: json.id,
        name: json.name,
        specialization: json.specialization,
        type: "doctor",
      });
    }

    subDoctors.forEach((d) => {
      const json = d.toJSON();
      doctors.push({
        id: json.id,
        name: decryptName(json.name),
        specialization: json.specialization,
        type: "subDoctor",
      });
    });

    doctors.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return res.status(200).json({ success: true, doctors });
  } catch (error) {
    console.error("getDoctors failed:", error);
    return res.status(500).json({ success: false, message: "Failed to get doctors." });
  }
};