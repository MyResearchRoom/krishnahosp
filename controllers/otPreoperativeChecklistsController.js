"use strict";

const getHospitalId = (req) => req.user?.hospitalId;
const { decrypt } = require("../utils/cryptography");

const {
  Doctor,
  OperatingTheatre,
  OTBooking,
  OTPreoperativeChecklist,
  OTPreoperativeChecklistItem,
  Patient,
  SubDoctor,
  Receptionist,
  sequelize,
} = require("../models");

const CHECKLIST_ITEM_STATUSES = [
  "pending",
  "done",
  "not_done",
  "not_applicable",
];

exports.getScheduledOTPreoperativeChecklists = async (req, res) => {
  const hospitalId = getHospitalId(req);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  try {
    const bookings = await OTBooking.findAll({
        attributes: [
            "id",
            "surgeryNo",
            "patientId",
            "doctorId",
            "theatreId",
            "procedureName",
            "scheduleDate",
            "scheduledStartTime",
            "scheduledEndTime",
            "status",
        ],
      where: {
        hospitalId,
        status: "scheduled",
      },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "patientId", "name", "mobileNumber", "email"],
          required: false,
        },
        {
          model: OperatingTheatre,
          as: "theatre",
          attributes: ["id", "theatreCode", "theatreName"],
          required: false,
        },
        {
          model: OTPreoperativeChecklist,
          as: "preoperativeChecklist",
          attributes: ["id", "otBookingId", "status","createdById","createdByRole"],
          include: [
            {
              model: OTPreoperativeChecklistItem,
              as: "items",
              attributes: [
                "id",
                "itemKey",
                "label",
                "status",
                "checkedById",
                "checkedByRole",
                "checkedAt",
              ],
            },
          ],
          required: false,
        },
      ],
      order: [
        ["scheduleDate", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    const creatorIdsByRole = {
      doctor: new Set(),
      subDoctor: new Set(),
      receptionist: new Set(),
    };

    bookings.forEach((booking) => {
      const checklist = booking.preoperativeChecklist;
      if (
        checklist?.createdById &&
        creatorIdsByRole[checklist.createdByRole]
      ) {
        creatorIdsByRole[checklist.createdByRole].add(
          checklist.createdById
        );
      }
    });

    const doctorCreatorIds = [...creatorIdsByRole.doctor]
      .map(Number)
      .filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0 &&
          id === Number(hospitalId)
      );

    const [doctors, subDoctors, receptionists] = await Promise.all([
      doctorCreatorIds.length
        ? Doctor.findAll({
            where: {
              id: doctorCreatorIds,
            },
            attributes: ["id", "name", "email"],
          })
        : [],
      creatorIdsByRole.subDoctor.size
        ? SubDoctor.findAll({
            where: {
              id: [...creatorIdsByRole.subDoctor],
              addedBy: hospitalId,
            },
            attributes: ["id", "name", "email"],
          })
        : [],
      creatorIdsByRole.receptionist.size
        ? Receptionist.findAll({
            where: {
              id: [...creatorIdsByRole.receptionist],
              doctorId: hospitalId,
            },
            attributes: ["id", "name", "email", "receptionistId"],
          })
        : [],
    ]);

    const creatorMaps = {
      doctor: new Map(
        doctors.map((creator) => [
          String(creator.id),
          {
            id: creator.id,
            name: creator.name ? decrypt(creator.name) : "",
            email: creator.email,
            role: "doctor",
          },
        ])
      ),
      subDoctor: new Map(
        subDoctors.map((creator) => [
          String(creator.id),
          {
            id: creator.id,
            name: creator.name ? decrypt(creator.name) : "",
            email: creator.email,
            role: "subDoctor",
          },
        ])
      ),
      receptionist: new Map(
        receptionists.map((creator) => [
          String(creator.id),
          {
            id: creator.id,
            receptionistId: creator.receptionistId,
            name: creator.name ? decrypt(creator.name) : "",
            email: creator.email,
            role: "receptionist",
          },
        ])
      ),
    };

    const data = bookings.map((booking) => {
      const bookingData = booking.toJSON();

      if (bookingData.patient) {
        for (const field of ["name", "mobileNumber", "email"]) {
          if (bookingData.patient[field]) {
            bookingData.patient[field] = decrypt(bookingData.patient[field]);
          }
        }
      }

      if (bookingData.preoperativeChecklist) {
        const checklist = bookingData.preoperativeChecklist;
        const creatorMap = creatorMaps[checklist.createdByRole];
        checklist.createdByDetails =
          creatorMap?.get(String(checklist.createdById)) || null;
      }

      return bookingData;
    });

    return res.status(200).json({
      success: true,
      message: "Scheduled OT preoperative checklists fetched successfully.",
      data,
    });
  } catch (error) {
    console.error("Get scheduled OT preoperative checklists error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch scheduled OT preoperative checklists.",
    });
  }
};

exports.addOTPreoperativeChecklistItems = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const checklistId = Number(req.params.checklistId);
  const { items } = req.body;

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(checklistId) || checklistId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid checklist ID is required.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one checklist item in the items array.",
    });
  }

  const itemKeys = new Set();
  for (const item of items) {
    if (
      !item ||
      typeof item.itemKey !== "string" ||
      !item.itemKey.trim() ||
      item.itemKey.trim().length > 100 ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      item.label.trim().length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "Each item must have a valid itemKey and label.",
      });
    }

    if (itemKeys.has(item.itemKey.trim())) {
      return res.status(400).json({
        success: false,
        message: "Item keys must be unique within the request.",
      });
    }
    itemKeys.add(item.itemKey.trim());

    if (
      item.status !== undefined &&
      !CHECKLIST_ITEM_STATUSES.includes(item.status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Item status must be one of: ${CHECKLIST_ITEM_STATUSES.join(", ")}.`,
      });
    }
  }

  try {
    const savedItems = await sequelize.transaction(async (transaction) => {
      const checklist = await OTPreoperativeChecklist.findOne({
        where: {
          id: checklistId,
          hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!checklist) {
        const error = new Error("Preoperative checklist not found.");
        error.status = 404;
        throw error;
      }

      if (checklist.status === "completed") {
        const error = new Error("Cannot add items to a completed checklist. If you wqnt to add, Update status of checklist");
        error.status = 409;
        throw error;
     }

      const existingItems = await OTPreoperativeChecklistItem.findAll({
        where: { checklistId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const existingItemCount = existingItems.length;
      const existingItemsByKey = new Map(
        existingItems.map((item) => [item.itemKey, item])
      );
      const itemsToCreate = [];

      for (const item of items) {
        const itemKey = item.itemKey.trim();
        const existingItem = existingItemsByKey.get(itemKey);

        if (!existingItem) {
          const status = item.status || "pending";
          const isChecked = status !== "pending";
          itemsToCreate.push({
            checklistId,
            itemKey,
            label: item.label.trim(),
            status,
            checkedById: isChecked ? String(req.user.id) : null,
            checkedByRole: isChecked ? req.user.role : null,
            checkedAt: isChecked ? new Date() : null,
          });
          continue;
        }

        if (existingItem.status === "done") {
          continue;
        }

        if (item.status !== undefined) {
          const isChecked = item.status !== "pending";
          await existingItem.update(
            {
              status: item.status,
              checkedById: isChecked ? String(req.user.id) : null,
              checkedByRole: isChecked ? req.user.role : null,
              checkedAt: isChecked ? new Date() : null,
            },
            { transaction }
          );
        }
      }

      const createdItems = itemsToCreate.length
        ? await OTPreoperativeChecklistItem.bulkCreate(itemsToCreate, {
            validate: true,
            transaction,
          })
        : [];

      const createdItemsByKey = new Map(
        createdItems.map((item) => [item.itemKey, item])
      );

      const resultItems = items.map(
        (item) =>
          existingItemsByKey.get(item.itemKey.trim()) ||
          createdItemsByKey.get(item.itemKey.trim())
      );

      if (existingItemCount === 0 && !checklist.startedAt) {
        await checklist.update(
          { startedAt: new Date(),
            status: "in_progress",
           },
          { transaction }
        );
      } else{

        await checklist.update(
            { status: "in_progress" },
            { transaction }
        );
      }

      return resultItems;
    });

    return res.status(201).json({
      success: true,
      message: "OT preoperative checklist items added or updated successfully.",
      data: savedItems,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "An item with one of these keys already exists in this checklist.",
      });
    }

    console.error("Add OT preoperative checklist items error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add OT preoperative checklist items.",
    });
  }
};

exports.getOTPreoperativeChecklistItemsByPatientAndChecklist = async (
  req,
  res
) => {
  const hospitalId = getHospitalId(req);
  const patientId = Number(req.params.patientId);
  const checklistId = Number(req.params.checklistId);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (
    !Number.isInteger(patientId) ||
    patientId <= 0 ||
    !Number.isInteger(checklistId) ||
    checklistId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid patient and checklist IDs are required.",
    });
  }

  try {
    const checklist = await OTPreoperativeChecklist.findOne({
      where: {
        id: checklistId,
        hospitalId,
      },
      attributes: ["id", "otBookingId", "status"],
      include: [
        {
          model: OTBooking,
          as: "otBooking",
          attributes: ["id", "patientId"],
          where: {
            patientId,
            hospitalId,
          },
          required: true,
        },
        {
          model: OTPreoperativeChecklistItem,
          as: "items",
          attributes: [
            "id",
            "itemKey",
            "label",
            "status",
            "checkedById",
            "checkedByRole",
            "checkedAt",
          ],
          required: false,
        },
      ],
    });

    if (!checklist) {
      return res.status(404).json({
        success: false,
        message: "Preoperative checklist not found for this patient.",
      });
    }

    const data = checklist.toJSON();
    const creatorIdsByRole = {
      doctor: new Set(),
      subDoctor: new Set(),
      receptionist: new Set(),
      nurse: new Set(),
    };

    data.items.forEach((item) => {
      if (item.checkedById && creatorIdsByRole[item.checkedByRole]) {
        creatorIdsByRole[item.checkedByRole].add(item.checkedById);
      }
    });

    const doctorIds = [...creatorIdsByRole.doctor]
      .map(Number)
      .filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0 &&
          id === Number(hospitalId)
      );
    const receptionistIds = [
      ...creatorIdsByRole.receptionist,
      ...creatorIdsByRole.nurse,
    ];

    const [doctors, subDoctors, receptionists] = await Promise.all([
      doctorIds.length
        ? Doctor.findAll({
            where: { id: doctorIds },
            attributes: ["id", "name", "email"],
          })
        : [],
      creatorIdsByRole.subDoctor.size
        ? SubDoctor.findAll({
            where: {
              id: [...creatorIdsByRole.subDoctor],
              addedBy: hospitalId,
            },
            attributes: ["id", "name", "email"],
          })
        : [],
      receptionistIds.length
        ? Receptionist.findAll({
            where: {
              id: receptionistIds,
              doctorId: hospitalId,
            },
            attributes: ["id", "name", "email", "receptionistId"],
          })
        : [],
    ]);

    const creatorsByRole = {
      doctor: new Map(
        doctors.map((creator) => [
          String(creator.id),
          {
            id: creator.id,
            name: creator.name ? decrypt(creator.name) : "",
            email: creator.email,
            role: "doctor",
          },
        ])
      ),
      subDoctor: new Map(
        subDoctors.map((creator) => [
          String(creator.id),
          {
            id: creator.id,
            name: creator.name ? decrypt(creator.name) : "",
            email: creator.email,
            role: "subDoctor",
          },
        ])
      ),
      receptionist: new Map(),
      nurse: new Map(),
    };

    for (const creator of receptionists) {
      const details = {
        id: creator.id,
        receptionistId: creator.receptionistId,
        name: creator.name ? decrypt(creator.name) : "",
        email: creator.email,
      };
      creatorsByRole.receptionist.set(String(creator.id), {
        ...details,
        role: "receptionist",
      });
      creatorsByRole.nurse.set(String(creator.id), {
        ...details,
        role: "nurse",
      });
    }

    data.items = data.items.map((item) => ({
      ...item,
      createdByDetails:
        creatorsByRole[item.checkedByRole]?.get(
          String(item.checkedById)
        ) || null,
    }));

    return res.status(200).json({
      success: true,
      message: "OT preoperative checklist items fetched successfully.",
      data,
    });
  } catch (error) {
    console.error("Get OT preoperative checklist items error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch OT preoperative checklist items.",
    });
  }
};

exports.completeOTPreoperativeChecklist = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const checklistId = Number(req.params.checklistId);
  const cdate = req.body?.cdate;
  const completedAt =
    cdate !== undefined && cdate !== null && cdate !== ""
      ? new Date(cdate)
      : new Date();

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(checklistId) || checklistId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid checklist ID is required.",
    });
  }

  if (Number.isNaN(completedAt.getTime())) {
    return res.status(400).json({
      success: false,
      message: "cdate must be a valid date.",
    });
  }

  try {
    const checklist = await sequelize.transaction(async (transaction) => {
      const existingChecklist = await OTPreoperativeChecklist.findOne({
        where: {
          id: checklistId,
          hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!existingChecklist) {
        const error = new Error("Preoperative checklist not found.");
        error.status = 404;
        throw error;
      }

      if (existingChecklist.status === "completed") {
        const error = new Error(
          "Checklist id already completed."
        );
        error.status = 400;
        throw error;
      }

      const items = await OTPreoperativeChecklistItem.findAll({
        where: { checklistId },
        attributes: ["id", "status"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (items.length === 0) {
        const error = new Error(
          "Add checklist items before completing the preoperative checklist."
        );
        error.status = 400;
        throw error;
      }

      if (items.some((item) => item.status === "pending")) {
        const error = new Error(
          "All checklist items must be checked before completing the preoperative checklist."
        );
        error.status = 400;
        throw error;
      }

      await existingChecklist.update(
        {
          status: "completed",
          completedAt,
        },
        { transaction }
      );

      return existingChecklist;
    });

    return res.status(200).json({
      success: true,
      message: "OT preoperative checklist completed successfully.",
      data: checklist,
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Complete OT preoperative checklist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete OT preoperative checklist.",
    });
  }
};

exports.markOTPreoperativeChecklistInProgress = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const checklistId = Number(req.params.checklistId);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(checklistId) || checklistId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid checklist ID is required.",
    });
  }

  try {
    const checklist = await sequelize.transaction(async (transaction) => {
      const existingChecklist = await OTPreoperativeChecklist.findOne({
        where: {
          id: checklistId,
          hospitalId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!existingChecklist) {
        const error = new Error("Preoperative checklist not found.");
        error.status = 404;
        throw error;
      }

      if (existingChecklist.status !== "completed") {
        const error = new Error(
          `Only a completed checklist can be changed to in progress. Current status is "${existingChecklist.status}".`
        );
        error.status = 409;
        throw error;
      }

      await existingChecklist.update(
        {
          status: "in_progress",
          startedAt: existingChecklist.startedAt || new Date(),
          completedAt: null,
        },
        { transaction }
      );

      return existingChecklist;
    });

    return res.status(200).json({
      success: true,
      message: "OT preoperative checklist marked as in progress.",
      data: checklist,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Mark OT preoperative checklist in progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark OT preoperative checklist as in progress.",
    });
  }
};