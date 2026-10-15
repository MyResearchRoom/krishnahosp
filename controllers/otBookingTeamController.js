const {
  Doctor,
  OTBooking,
  OTBookingTeam,
  SubDoctor,
  Receptionist,
  sequelize,
} = require("../models");

const getHospitalId = (req) => req.user?.hospitalId;

const TEAM_ROLES = [
  "primarySurgeon",
  "assistantSurgeon",
  "anaesthetist",
  "otNurse",
  "scrubNurse",
];
const MEMBER_TYPES = ["doctor", "subDoctor", "receptionist"];

exports.getOTBookingTeam = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  try {
    const booking = await OTBooking.findOne({
      where: {
        id: bookingId,
        hospitalId,
      },
      attributes: ["id"],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "OT booking not found.",
      });
    }

    const team = await OTBookingTeam.findAll({
      where: {
        hospitalId,
        otBookingId: bookingId,
      },
      order: [
        ["teamRole", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      message: "OT booking team fetched successfully.",
      data: team,
    });
  } catch (error) {
    console.error("Get OT booking team error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch OT booking team.",
    });
  }
};

exports.addOTBookingTeam = async (req, res) => {
  const hospitalId = getHospitalId(req);
  const bookingId = Number(req.params.id);
  const teamByRole = req.body;

  if (!hospitalId) {
    return res.status(401).json({
      success: false,
      message: "Hospital ID is required.",
    });
  }

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid OT booking ID is required.",
    });
  }

  if (
    !teamByRole ||
    typeof teamByRole !== "object" ||
    Array.isArray(teamByRole)
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide team members grouped by team role.",
    });
  }

  const invalidRole = Object.keys(teamByRole).find(
    (role) => !TEAM_ROLES.includes(role)
  );
  if (invalidRole) {
    return res.status(400).json({
      success: false,
      message: `Unsupported team role "${invalidRole}". Allowed roles: ${TEAM_ROLES.join(", ")}.`,
    });
  }

  const teamMembers = [];
  for (const teamRole of TEAM_ROLES) {
    const members = teamByRole[teamRole];
    if (members === undefined) {
      continue;
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: `"${teamRole}" must be a non-empty array of team members.`,
      });
    }

    for (const member of members) {
      if (
        !member ||
        typeof member !== "object" ||
        Array.isArray(member) ||
        !MEMBER_TYPES.includes(member.memberType) ||
        (typeof member.memberId !== "string" &&
          typeof member.memberId !== "number") ||
        !String(member.memberId).trim() ||
        String(member.memberId).trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: `Each "${teamRole}" member must have a valid memberType and memberId.`,
        });
      }

      teamMembers.push({
        teamRole,
        memberType: member.memberType,
        memberId: String(member.memberId).trim(),
      });
    }
  }

  if (teamMembers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one team member.",
    });
  }

  const memberKeys = new Set();
  for (const member of teamMembers) {
    const key = `${member.teamRole}:${member.memberType}:${member.memberId}`;
    if (memberKeys.has(key)) {
      return res.status(400).json({
        success: false,
        message: "The same member cannot be assigned more than once to a team role.",
      });
    }
    memberKeys.add(key);
  }

  try {
    const createdTeamMembers = await sequelize.transaction(
      async (transaction) => {
        const booking = await OTBooking.findOne({
          where: {
            id: bookingId,
            hospitalId,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!booking) {
          const error = new Error("OT booking not found.");
          error.status = 404;
          throw error;
        }

        for (const member of teamMembers) {
          let foundMember;

          if (member.memberType === "doctor") {
            const doctorId = Number(member.memberId);
            if (Number.isInteger(doctorId) && doctorId > 0) {
              foundMember = await Doctor.findOne({
                where: { id: doctorId },
                transaction,
              });
            }
          } else if (member.memberType === "subDoctor") {
            foundMember = await SubDoctor.findOne({
              where: {
                id: member.memberId,
                addedBy: hospitalId,
              },
              transaction,
            });
          } else {
            const receptionistId = Number(member.memberId);
            if (Number.isInteger(receptionistId) && receptionistId > 0) {
              foundMember = await Receptionist.findOne({
                where: {
                  id: receptionistId,
                  doctorId: hospitalId,
                },
                transaction,
              });
            }
          }

          if (!foundMember) {
            const error = new Error(
              `${member.memberType} member "${member.memberId}" was not found for this hospital.`
            );
            error.status = 404;
            throw error;
          }
        }

        const existingAssignments = await OTBookingTeam.findAll({
          where: {
            hospitalId,
            otBookingId: bookingId,
          },
          transaction,
        });
        const existingAssignmentKeys = new Set(
          existingAssignments.map(
            (assignment) =>
              `${assignment.teamRole}:${assignment.memberType}:${assignment.memberId}`
          )
        );
        const newMembers = teamMembers.filter(
          (member) =>
            !existingAssignmentKeys.has(
              `${member.teamRole}:${member.memberType}:${member.memberId}`
            )
        );

        if (newMembers.length === 0) {
          const error = new Error(
            "All provided team members are already assigned to this OT booking."
          );
          error.status = 409;
          throw error;
        }

        return OTBookingTeam.bulkCreate(
          newMembers.map((member) => ({
            ...member,
            hospitalId,
            otBookingId: bookingId,
            assignedById: String(req.user.id),
            assignedByRole: req.user.role,
          })),
          {
            validate: true,
            transaction,
          }
        );
      }
    );

    return res.status(201).json({
      success: true,
      message: "OT booking team members added successfully.",
      data: createdTeamMembers,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Add OT booking team members error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add OT booking team members.",
    });
  }
};