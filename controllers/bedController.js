const { Op } = require("sequelize");
const { Bed, IPDAdmission, Room, Ward, Patient, sequelize } = require("../models");
const { decrypt } = require("../utils/cryptography");

const createSequence = async (Model, field, prefix, doctorId, transaction) => {
  const year = new Date().getFullYear();
  const count = await Model.count({ where: { doctorId }, transaction });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
};

const getHospitalId = (req) => req.user?.hospitalId || req.user?.id;

const VALID_STATUSES = ["available", "occupied", "maintenance", "discharged"];

const normalizeStatus = (status) =>
  typeof status === "string" ? status.toLowerCase() : undefined;

const findRoomForBed = async ({ doctorId, roomId, wardId, roomNumber, transaction }) => {
  const where = { doctorId };
  if (roomId) where.id = roomId;
  if (!roomId && wardId) where.wardId = wardId;
  if (!roomId && roomNumber) where.roomNumber = roomNumber;

  return Room.findOne({
    where,
    include: [{ model: Ward, as: "ward", attributes: ["id", "wardName"] }],
    transaction,
  });
};

const validatePatient = async ({ doctorId, patientId, transaction }) => {
  if (!patientId) return null;

  const patient = await Patient.findOne({
    where: {
      id: patientId,
      doctorId,
    },
    attributes: ["id", "name", "patientId"],
    transaction,
  });

  if (!patient) {
    return {
      patient: null,
      admission: null,
    };
  }

  const admission = await IPDAdmission.findOne({
    where: {
      doctorId,
      // patientId must match your actual IPDAdmission column
      patientId,
      status: "admitted",
    },
    transaction,
  });

  return {
    patient,
    admission,
  };
};

const decryptSafe = (value) => {
  if (!value) return value;
  try {
    return decrypt(value);
  } catch (error) {
    return value;
  }
};

const formatPatient = (patient) => {
  if (!patient) return null;
  return {
    id: patient.id,
    name: decryptSafe(patient.name),
    mrn: patient.patientId,
  };
};

const formatBed = (bed) => {
  const plainBed = bed.toJSON();

  return {
    ...plainBed,
    wardName: plainBed.ward?.wardName,
    roomNumber: plainBed.room?.roomNumber,
    patient: formatPatient(plainBed.patient),
  };
};

exports.createBed = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const {
      roomId,
      wardId,
      roomNumber,
      bedCode,
      bedType,
      pricePerDay,
      status,
      patientId,
    } = req.body;
    const normalizedStatus = normalizeStatus(status) || "available";

    if (!bedCode?.trim() || !bedType?.trim()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Bed number and bed type are required.",
      });
    }

    if (!VALID_STATUSES.includes(normalizedStatus)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invalid bed status." });
    }

    if (normalizedStatus === "occupied" && !patientId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Select a patient for occupied beds.",
      });
    }

    const room = await findRoomForBed({ doctorId, roomId, wardId, roomNumber, transaction });
    if (!room) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    const existingBed = await Bed.findOne({
      where: { roomId: room.id, bedCode: bedCode.trim() },
      transaction,
    });

    if (existingBed) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Bed number already exists in this room.",
      });
    }

    const existingBedCount = await Bed.count({ where: { roomId: room.id }, transaction });
    if (existingBedCount >= room.capacity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Room capacity is already full.",
      });
    }

    const patientRecord = await validatePatient({
      doctorId,
      patientId,
      transaction,
    });
    if (patientId && !patientRecord?.patient) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    const bed = await Bed.create({
      bedCode: bedCode.trim(),
      bedType: bedType.trim(),
      pricePerDay: Number(pricePerDay || 0),
      status: normalizedStatus,
      patientId: normalizedStatus === "occupied" ? patientId || null : null,
      roomId: room.id,
      wardId: room.wardId,
      doctorId,
    }, { transaction });

    if (normalizedStatus === "occupied" && patientRecord?.admission) {
      if (patientRecord.admission.bedId && Number(patientRecord.admission.bedId) !== Number(bed.id)) {
        await Bed.update(
          { status: "available", patientId: null },
          {
            where: { id: patientRecord.admission.bedId, doctorId },
            transaction,
          }
        );
      }

      await patientRecord.admission.update(
        { bedId: bed.id, roomId: room.id, wardId: room.wardId },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Bed added successfully",
      bed: {
        ...bed.toJSON(),
        wardName: room.ward?.wardName,
        roomNumber: room.roomNumber,
        patient: formatPatient(patientRecord?.patient),
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return res
      .status(500)
      .json({ success: false, message: "Failed to add bed" });
  }
};

exports.getBeds = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const {
      searchTerm,
      wardId,
      roomId,
      roomNumber,
      bedType,
      status,
    } = req.query;
    const where = { doctorId };
    const roomWhere = {};
    const normalizedStatus = normalizeStatus(status);

    if (wardId) where.wardId = wardId;
    if (roomId) where.roomId = roomId;
    if (roomNumber && roomNumber !== "All Rooms") roomWhere.roomNumber = roomNumber;
    if (bedType && bedType !== "All Bed Types") where.bedType = bedType;
    if (normalizedStatus && normalizedStatus !== "all status") {
      where.status = normalizedStatus;
    }
    if (searchTerm) where.bedCode = { [Op.like]: `%${searchTerm}%` };

    const beds = await Bed.findAll({
      where,
      include: [
        { model: Ward, as: "ward", attributes: ["id", "wardName"] },
        {
          model: Room,
          as: "room",
          attributes: ["id", "roomNumber", "capacity"],
          where: Object.keys(roomWhere).length ? roomWhere : undefined,
        },
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "patientId"],
          required: false,
        },
      ],
      order: [
        [{ model: Ward, as: "ward" }, "wardName", "ASC"],
        [{ model: Room, as: "room" }, "roomNumber", "ASC"],
        ["bedCode", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      beds: beds.map(formatBed),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get beds" });
  }
};

exports.getBedHierarchy = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const rooms = await Room.findAll({
      where: { doctorId },
      include: [
        { model: Ward, as: "ward", attributes: ["id", "wardName"] },
        {
          model: Bed,
          as: "beds",
          required: false,
          include: [
            {
              model: Patient,
              as: "patient",
              attributes: ["id", "name", "patientId"],
              required: false,
            },
          ],
        },
      ],
      order: [
        [{ model: Ward, as: "ward" }, "wardName", "ASC"],
        ["roomNumber", "ASC"],
        [{ model: Bed, as: "beds" }, "bedCode", "ASC"],
      ],
    });

    const hierarchy = rooms.map((room, index) => {
      const plainRoom = room.toJSON();
      return {
        wardId: plainRoom.wardId,
        roomId: plainRoom.id,
        wardName: plainRoom.ward?.wardName,
        roomNumber: plainRoom.roomNumber,
        capacity: plainRoom.capacity,
        defaultExpanded: index === 0,
        beds: (plainRoom.beds || []).map((bed) => ({
          id: bed.id,
          bedCode: bed.bedCode,
          status: bed.status,
          bedType: bed.bedType,
          pricePerDay: bed.pricePerDay,
          patient: formatPatient(bed.patient),
        })),
      };
    });

    return res.status(200).json({ success: true, hierarchy });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get bed hierarchy",
    });
  }
};

exports.getBedStats = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const [totalBeds, occupiedBeds, availableBeds, maintenanceBeds] =
      await Promise.all([
        Bed.count({ where: { doctorId } }),
        Bed.count({ where: { doctorId, status: "occupied" } }),
        Bed.count({ where: { doctorId, status: "available" } }),
        Bed.count({ where: { doctorId, status: "maintenance" } }),
      ]);

    return res.status(200).json({
      success: true,
      stats: { totalBeds, occupiedBeds, availableBeds, maintenanceBeds },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get bed stats" });
  }
};

exports.updateBed = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const doctorId = getHospitalId(req);
    const bed = await Bed.findOne({ where: { id: req.params.id, doctorId }, transaction });

    if (!bed) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Bed not found" });
    }

    const {
      roomId,
      wardId,
      roomNumber,
      bedCode,
      bedType,
      pricePerDay,
      status,
      patientId,
    } = req.body;
    const normalizedStatus = normalizeStatus(status);

    if (normalizedStatus && !VALID_STATUSES.includes(normalizedStatus)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Invalid bed status." });
    }

    let nextRoom = null;
    if (roomId || wardId || roomNumber) {
      nextRoom = await findRoomForBed({ doctorId, roomId, wardId, roomNumber, transaction });
      if (!nextRoom) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ success: false, message: "Room not found" });
      }
    }

    const nextRoomId = nextRoom?.id || bed.roomId;
    const nextBedCode = bedCode?.trim() || bed.bedCode;
    const duplicateBed = await Bed.findOne({
      where: {
        roomId: nextRoomId,
        bedCode: nextBedCode,
        id: { [Op.ne]: bed.id },
      },
      transaction,
    });

    if (duplicateBed) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Bed number already exists in this room.",
      });
    }

    const nextStatus = normalizedStatus || bed.status;
    if (nextStatus !== "occupied") {
      const activeAdmission = await IPDAdmission.findOne({
        where: { doctorId, bedId: bed.id, status: "admitted" },
        transaction,
      });

      if (activeAdmission) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Transfer or discharge the patient before changing this bed status.",
        });
      }
    }

    if (nextStatus === "occupied" && !patientId && !bed.patientId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Select a patient for occupied beds.",
      });
    }

    const nextPatientId = nextStatus === "occupied" ? patientId || bed.patientId : null;
    const patientRecord = await validatePatient({
      doctorId,
      patientId: nextPatientId,
      transaction,
    });
    if (nextPatientId && !patientRecord?.patient) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    await bed.update({
      bedCode: nextBedCode,
      bedType: bedType?.trim() || bed.bedType,
      pricePerDay:
        pricePerDay === undefined ? bed.pricePerDay : Number(pricePerDay || 0),
      status: nextStatus,
      patientId: nextPatientId,
      roomId: nextRoomId,
      wardId: nextRoom?.wardId || bed.wardId,
    }, { transaction });

  if (nextStatus === "occupied") {
  if (patientRecord?.admission) {
    if (
      patientRecord.admission.bedId &&
      Number(patientRecord.admission.bedId) !== Number(bed.id)
    ) {
      await Bed.update(
        { status: "available", patientId: null },
        {
          where: { id: patientRecord.admission.bedId, doctorId },
          transaction,
        }
      );
    }

    await patientRecord.admission.update(
      {
        bedId: bed.id,
        roomId: nextRoomId,
        wardId: nextRoom?.wardId || bed.wardId,
      },
      { transaction }
    );
  } else {
    // OPD patient assigned to IPD bed for the first time
    const admissionNumber = await createSequence(
      IPDAdmission,
      "admissionNumber",
      "ADM",
      doctorId,
      transaction
    );

    await IPDAdmission.create(
      {
        admissionNumber,
        patientId: nextPatientId,
        bedId: bed.id,
        roomId: nextRoomId,
        wardId: nextRoom?.wardId || bed.wardId,
        doctorId,
        status: "admitted",
        attendingDoctorName: req.user?.name || "Doctor",
        doctorRole: "General",
        department: "General Medicine",
        admissionReason: "IPD Bed Assignment",
        diagnosis: null,
        clinicalStatus: "Stable",
        admissionDate: new Date(),
        advancePayment: 0,
      },
      { transaction }
    );
  }
}

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Bed updated successfully",
      bed,
    });
  } catch (error) {
    console.log(error);
    
    if (transaction && !transaction.finished) await transaction.rollback();
    return res
      .status(500)
      .json({ success: false, message: "Failed to update bed" });
  }
};

exports.getOccupiedBedPatients = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);

    const beds = await Bed.findAll({
      where: {
        doctorId,
        status: "occupied",
        patientId: { [Op.ne]: null },
      },
      include: [
        {
          model: Ward,
          as: "ward",
          attributes: ["id", "wardName"],
        },
        {
          model: Room,
          as: "room",
          attributes: ["id", "roomNumber"],
        },
        {
          model: Patient,
          as: "patient",
          attributes: [
            "id",
            "name",
            "patientId",
            "gender",
            "age",
            "mobileNumber",
          ],
        },
      ],
      order: [
        [{ model: Ward, as: "ward" }, "wardName", "ASC"],
        [{ model: Room, as: "room" }, "roomNumber", "ASC"],
        ["bedCode", "ASC"],
      ],
    });

    const occupiedBedPatients = await Promise.all(
      beds.map(async (bed) => {
        const plainBed = bed.toJSON();

        // First try to find admission using bedId
        let admission = await IPDAdmission.findOne({
          where: {
            doctorId,
            bedId: plainBed.id,
            status: "admitted",
          },
          order: [["id", "DESC"]],
        });

        // If not found by bed, try patientId
        if (!admission && plainBed.patientId) {
          admission = await IPDAdmission.findOne({
            where: {
              doctorId,
              patientId: plainBed.patientId,
              status: "admitted",
            },
            order: [["id", "DESC"]],
          });
        }

        console.log("DISCHARGE BED CHECK:", {
          bedId: plainBed.id,
          patientId: plainBed.patientId,
          admissionId: admission?.id || null,
          admissionPatientId: admission?.patientId || null,
          admissionBedId: admission?.bedId || null,
          admissionStatus: admission?.status || null,
        });

        return {
          bedId: plainBed.id,
          bedCode: plainBed.bedCode,
          bedType: plainBed.bedType,
          pricePerDay: plainBed.pricePerDay,

          wardId: plainBed.wardId,
          wardName: plainBed.ward?.wardName,

          roomId: plainBed.roomId,
          roomNumber: plainBed.room?.roomNumber,

          admissionId: admission?.id || null,
          admissionNumber: admission?.admissionNumber || null,
          admissionDate:
            admission?.admissionDate ||
            plainBed.updatedAt ||
            plainBed.createdAt,

          diagnosis: admission?.diagnosis || "",

          patient: formatPatient(plainBed.patient),
        };
      })
    );

    return res.status(200).json({
      success: true,
      beds: occupiedBedPatients,
    });
  } catch (error) {
    console.error("Error in getOccupiedBedPatients:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get occupied bed patients",
    });
  }
};

exports.deleteBed = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);

    const bed = await Bed.findOne({
      where: {
        id: req.params.id,
        doctorId,
      },
    });

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Bed not found",
      });
    }

    const activeAdmission = await IPDAdmission.findOne({
      where: {
        doctorId,
        bedId: bed.id,
        status: "admitted",
      },
    });

    if (activeAdmission) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete this bed because a patient is currently admitted to it. Transfer or discharge the patient first.",
      });
    }

    await bed.destroy();

    return res.status(200).json({
      success: true,
      message: "Bed deleted successfully",
    });
  } catch (error) {
    console.error("Delete bed error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete bed",
      error: error.message,
    });
  }
};

