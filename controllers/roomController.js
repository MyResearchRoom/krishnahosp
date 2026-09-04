const { Op } = require("sequelize");
const { Room, Ward, Bed } = require("../models");

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

const formatRoom = (room) => {
  const plainRoom = room.toJSON();
  const { availableBeds, occupiedBeds } = summarizeBeds(
    plainRoom.capacity,
    plainRoom.beds
  );

  delete plainRoom.beds;

  return {
    ...plainRoom,
    wardName: plainRoom.ward?.wardName,
    availableBeds,
    occupiedBeds,
  };
};

const findWardForRoom = async ({ doctorId, wardId, wardName }) => {
  const where = { doctorId };
  if (wardId) where.id = wardId;
  if (!wardId && wardName) where.wardName = wardName.trim();
  return Ward.findOne({ where });
};

exports.createRoom = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { roomNumber, wardId, wardName, roomType, capacity } = req.body;
    const parsedCapacity = toPositiveInteger(capacity);

    if (!roomNumber?.trim() || !roomType?.trim() || !parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: "Room number, room type, and capacity are required.",
      });
    }

    const ward = await findWardForRoom({ doctorId, wardId, wardName });
    if (!ward) {
      return res
        .status(404)
        .json({ success: false, message: "Ward not found" });
    }

    const existingRoom = await Room.findOne({
      where: { wardId: ward.id, roomNumber: roomNumber.trim() },
    });

    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: "Room number already exists in this ward.",
      });
    }

    const room = await Room.create({
      roomNumber: roomNumber.trim(),
      wardId: ward.id,
      roomType: roomType.trim(),
      capacity: parsedCapacity,
      doctorId,
    });

    return res.status(201).json({
      success: true,
      message: "Room added successfully",
      room: {
        ...room.toJSON(),
        wardName: ward.wardName,
        availableBeds: parsedCapacity,
        occupiedBeds: 0,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to add room" });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { searchTerm, wardId, wardName } = req.query;
    const where = { doctorId };
    const wardWhere = {};

    if (wardId) where.wardId = wardId;
    if (wardName && wardName !== "All Wards") wardWhere.wardName = wardName;
    if (searchTerm) {
      where[Op.or] = [
        { roomNumber: { [Op.like]: `%${searchTerm}%` } },
        { roomType: { [Op.like]: `%${searchTerm}%` } },
      ];
    }

    const rooms = await Room.findAll({
      where,
      include: [
        {
          model: Ward,
          as: "ward",
          attributes: ["id", "wardName", "location"],
          where: Object.keys(wardWhere).length ? wardWhere : undefined,
        },
        {
          model: Bed,
          as: "beds",
          attributes: ["id", "status"],
          required: false,
        },
      ],
      order: [
        [{ model: Ward, as: "ward" }, "wardName", "ASC"],
        ["roomNumber", "ASC"],
      ],
    });

    return res
      .status(200)
      .json({ success: true, rooms: rooms.map(formatRoom) });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get rooms" });
  }
};

exports.getRoomStats = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const rooms = await Room.findAll({
      where: { doctorId },
      include: [
        {
          model: Ward,
          as: "ward",
          attributes: ["id", "wardName"],
        },
        {
          model: Bed,
          as: "beds",
          attributes: ["id", "status"],
          required: false,
        },
      ],
    });

    const totals = rooms.map(formatRoom).reduce(
      (acc, room) => ({
        totalRooms: acc.totalRooms + 1,
        totalCapacity: acc.totalCapacity + Number(room.capacity || 0),
        availableBeds: acc.availableBeds + room.availableBeds,
        occupiedBeds: acc.occupiedBeds + room.occupiedBeds,
      }),
      { totalRooms: 0, totalCapacity: 0, availableBeds: 0, occupiedBeds: 0 }
    );

    return res.status(200).json({ success: true, stats: totals });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get room stats" });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);
    const { roomNumber, wardId, wardName, roomType, capacity } = req.body;

    const room = await Room.findOne({ where: { id: req.params.id, doctorId } });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    let nextWardId = room.wardId;
    if (wardId || wardName) {
      const ward = await findWardForRoom({ doctorId, wardId, wardName });
      if (!ward) {
        return res
          .status(404)
          .json({ success: false, message: "Ward not found" });
      }
      nextWardId = ward.id;
    }

    const nextRoomNumber = roomNumber?.trim() || room.roomNumber;
    const duplicateRoom = await Room.findOne({
      where: {
        wardId: nextWardId,
        roomNumber: nextRoomNumber,
        id: { [Op.ne]: room.id },
      },
    });

    if (duplicateRoom) {
      return res.status(400).json({
        success: false,
        message: "Room number already exists in this ward.",
      });
    }

    const parsedCapacity =
      capacity === undefined ? undefined : toPositiveInteger(capacity);
    if (capacity !== undefined && !parsedCapacity) {
      return res
        .status(400)
        .json({ success: false, message: "Capacity must be greater than 0." });
    }

    await room.update({
      roomNumber: nextRoomNumber,
      wardId: nextWardId,
      roomType: roomType?.trim() || room.roomType,
      capacity: parsedCapacity || room.capacity,
    });

    await Bed.update(
      { wardId: nextWardId },
      { where: { roomId: room.id, doctorId } }
    );

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      room,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to update room" });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const doctorId = getHospitalId(req);

    const room = await Room.findOne({
      where: {
        id: req.params.id,
        doctorId,
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Check whether this room has any beds
    const bedCount = await Bed.count({
      where: {
        roomId: room.id,
        doctorId,
      },
    });

    if (bedCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete this room. Please delete all beds under this room first.",
      });
    }

    await room.destroy();

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("Delete room error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete room",
    });
  }
};
