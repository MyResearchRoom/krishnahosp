const { Op } = require("sequelize");
const { Ward, Bed, Room, IPDAdmission } = require("../models");

const getHospitalId = (req) => req.user?.hospitalId || req.user?.id;

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const summarizeBeds = (capacity, beds = []) => {
  const occupiedBeds = beds.filter((bed) => bed.status === "occupied").length;
  const maintenanceBeds = beds.filter(
    (bed) => bed.status === "maintenance"
  ).length;
  const availableBeds = Math.max(capacity - occupiedBeds - maintenanceBeds, 0);

  return { availableBeds, occupiedBeds };
};

const formatWard = (ward) => {
  const plainWard = ward.toJSON();
  const { availableBeds, occupiedBeds } = summarizeBeds(
    plainWard.capacity,
    plainWard.beds
  );

  delete plainWard.beds;

  return {
    ...plainWard,
    availableBeds,
    occupiedBeds,
  };
};

exports.createWard = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { wardName, location, capacity } = req.body;
    const parsedCapacity = toPositiveInteger(capacity);

    if (!wardName?.trim() || !location?.trim() || !parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: "Ward name, location, and capacity are required.",
      });
    }

    const existingWard = await Ward.findOne({
      where: { doctorId, wardName: wardName.trim() },
    });

    if (existingWard) {
      return res.status(400).json({
        success: false,
        message: "Ward with this name already exists.",
      });
    }

    const ward = await Ward.create({
      wardName: wardName.trim(),
      location: location.trim(),
      capacity: parsedCapacity,
      doctorId,
    });

    return res.status(201).json({
      success: true,
      message: "Ward added successfully",
      ward: { ...ward.toJSON(), availableBeds: parsedCapacity, occupiedBeds: 0 },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to add ward" });
  }
};

exports.getWards = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { searchTerm } = req.query;
    const where = { doctorId };

    if (searchTerm) {
      where.wardName = { [Op.like]: `%${searchTerm}%` };
    }

    const wards = await Ward.findAll({
      where,
      include: [
        {
          model: Bed,
          as: "beds",
          attributes: ["id", "status"],
          required: false,
        },
      ],
      order: [["wardName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      wards: wards.map(formatWard),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get wards" });
  }
};

exports.getWardStats = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);

    const wards = await Ward.findAll({
      where: { doctorId },
      include: [
        {
          model: Bed,
          as: "beds",
          attributes: ["id", "status"],
          required: false,
        },
      ],
    });

    const totals = wards.map(formatWard).reduce(
      (acc, ward) => ({
        totalWards: acc.totalWards + 1,
        totalCapacity: acc.totalCapacity + Number(ward.capacity || 0),
        availableBeds: acc.availableBeds + ward.availableBeds,
        occupiedBeds: acc.occupiedBeds + ward.occupiedBeds,
      }),
      { totalWards: 0, totalCapacity: 0, availableBeds: 0, occupiedBeds: 0 }
    );

    return res.status(200).json({ success: true, stats: totals });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get ward stats" });
  }
};

exports.updateWard = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { id } = req.params;
    const { wardName, location, capacity } = req.body;

    const ward = await Ward.findOne({ where: { id, doctorId } });
    if (!ward) {
      return res
        .status(404)
        .json({ success: false, message: "Ward not found" });
    }

    if (wardName?.trim() && wardName.trim() !== ward.wardName) {
      const duplicateWard = await Ward.findOne({
        where: {
          doctorId,
          wardName: wardName.trim(),
          id: { [Op.ne]: id },
        },
      });

      if (duplicateWard) {
        return res.status(400).json({
          success: false,
          message: "Ward with this name already exists.",
        });
      }
    }

    const parsedCapacity =
      capacity === undefined ? undefined : toPositiveInteger(capacity);
    if (capacity !== undefined && !parsedCapacity) {
      return res
        .status(400)
        .json({ success: false, message: "Capacity must be greater than 0." });
    }

    await ward.update({
      wardName: wardName?.trim() || ward.wardName,
      location: location?.trim() || ward.location,
      capacity: parsedCapacity || ward.capacity,
    });

    return res.status(200).json({
      success: true,
      message: "Ward updated successfully",
      ward,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to update ward" });
  }
};

exports.deleteWard = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { id } = req.params;

    console.log("========== DELETE WARD ==========");
    console.log("Ward ID:", id);
    console.log("Doctor/Hospital ID:", doctorId);

    const ward = await Ward.findOne({
      where: {
        id,
        doctorId,
      },
    });

    console.log("Ward found:", ward ? ward.toJSON() : null);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward not found",
      });
    }

    // Check whether rooms exist under this ward
    const roomCount = await Room.count({
      where: {
        wardId: id,
        doctorId,
      },
    });

    console.log("Rooms under ward:", roomCount);

    if (roomCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete this ward. Please delete all rooms under this ward first.",
      });
    }

    // Check whether beds exist directly under this ward
    const bedCount = await Bed.count({
      where: {
        wardId: id,
        doctorId,
      },
    });

    console.log("Beds under ward:", bedCount);

    if (bedCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete this ward. Please delete all beds under this ward first.",
      });
    }

    // Extra safety check:
    // Make sure no IPD admission is still linked to this ward
    const admissionCount = await IPDAdmission.count({
      where: {
        wardId: id,
        doctorId,
        status: "admitted",
      },
    });

    console.log("Active admissions under ward:", admissionCount);

    if (admissionCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete this ward. There are active patient admissions associated with this ward.",
      });
    }

    // Only delete the ward when no dependent records exist
    await ward.destroy();

    console.log("Ward deleted successfully");

    return res.status(200).json({
      success: true,
      message: "Ward deleted successfully",
    });
  } catch (error) {
    console.error("========== DELETE WARD ERROR ==========");
    console.error(error);
    console.error("Message:", error.message);
    console.error("Name:", error.name);
    console.error("Parent:", error.parent);
    console.error("Original:", error.original);
    console.error("======================================");

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete ward",
    });
  }
};