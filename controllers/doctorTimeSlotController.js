const { DoctorTimeSlot, Doctor, SubDoctor } = require("../models");

exports.createSlot = async (req, res) => {
  try {
    const {
      doctorId,
      doctorType,
      slotName,
      startTime,
      endTime,
      maxCapacity,
      availabilityIds,
    } = req.body;

    const slot = await DoctorTimeSlot.create({
      doctorId: doctorType === "doctor" ? req.user.id : null,
      subDoctorId: doctorType === "subDoctor" ? doctorId : null,
      slotName,
      startTime,
      endTime,
      maxCapacity,
      availabilityIds,
    });

    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create slot" });
  }
};

exports.getSlots = async (req, res) => {
  try {
    const [mainDoctorSlots, subDoctorSlots] = await Promise.all([
      Doctor.findOne({
        where: {
          id: req.user.id,
        },
        attributes: ["id", "name"],
        include: [
          {
            model: DoctorTimeSlot,
            as: "slots",
            required: false,
          },
        ],
      }),
      SubDoctor.findAll({
        where: {
          addedBy: req.user.id,
        },
        attributes: ["id", "name"],
        include: [
          {
            model: DoctorTimeSlot,
            as: "slots",
            required: false,
          },
        ],
      }),
    ]);

  
    res.status(200).json({
      success: true,
      data: mainDoctorSlots
        ? [
            {
              ...mainDoctorSlots.toJSON(),
              slots: [
                ...mainDoctorSlots.slots.map((slot) => ({
                  ...slot.toJSON(),
                  availabilityIds:
                    typeof slot.availabilityIds === "string"
                      ? JSON.parse(slot.availabilityIds)
                      : slot.availabilityIds,
                })),
              ],
              type: "doctor",
            },
            ...subDoctorSlots.map((doc) => ({
              ...doc.toJSON(),
              slots: [
                ...doc.slots.map((slot) => ({
                  ...slot.toJSON(),
                  availabilityIds:
                    typeof slot.availabilityIds === "string"
                      ? JSON.parse(slot.availabilityIds)
                      : slot.availabilityIds,
                })),
              ],
              type: "subDoctor",
            })),
          ]
        : [
            ...subDoctorSlots.map((doc) => ({
              ...doc.toJSON(),
              slots: [
                ...doc.slots.map((slot) => ({
                  ...slot.toJSON(),
                  availabilityIds:
                    typeof slot.availabilityIds === "string"
                      ? JSON.parse(slot.availabilityIds)
                      : slot.availabilityIds,
                })),
              ],
              type: "subDoctor",
            })),
          ],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch slots" });
  }
};

exports.updateSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { slotName, startTime, endTime, maxCapacity, availabilityIds } =
      req.body;

    const slot = await DoctorTimeSlot.findOne({
      where: { id, doctorId: req.user.id },
    });

    if (!slot) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }

    await slot.update({
      slotName: slotName ?? slot.slotName,
      startTime: startTime ?? slot.startTime,
      endTime: endTime ?? slot.endTime,
      maxCapacity: maxCapacity ?? slot.maxCapacity,
      availabilityIds: availabilityIds ?? slot.availabilityIds,
    });

    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update slot" });
  }
};

exports.deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;

    const slot = await DoctorTimeSlot.findOne({
      where: { id },
      include: {
        model: SubDoctor,
        as: "subDoctor",
        attributes: ["id", "addedBy"],
      },
    });

    if (!slot) {
      return res
        .status(404)
        .json({ success: false, message: "Slot not found" });
    }

    if (slot.doctorId && slot.doctorId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // if (slot.subDoctorId && slot.subDoctor.addedBy !== req.user.id) {
    //   return res.status(403).json({ success: false, message: "Forbidden" });
    // }

    await slot.destroy();
    res.json({ success: true, message: "Slot deleted successfully", data: id });
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ success: false, message: "Failed to delete slot" });
  }
};

exports.getSubDoctorSlots = async (req, res) => {
  try {
    const slots = await DoctorTimeSlot.findAll({
      where: {
        subDoctorId: req.user.id,
      },
    });

    res.status(200).json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get slots." });
  }
};
