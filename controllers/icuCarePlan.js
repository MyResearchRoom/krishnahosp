const { Op } = require("sequelize");

const { ICUCarePlan, ICUAdmission, Patient,Receptionist,Doctor,SubDoctor} = require("../models");
const { decrypt } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

exports.addICUCarePlan = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      icuAdmissionId,
      patientId,
      problem,
      goal,
      intervention,
      frequency,
      assignedNurseId,
      startDate,
      reviewDate,
    } = req.body;

    if (
      !icuAdmissionId ||
      !patientId ||
      !problem ||
      !goal ||
      !frequency ||
      !assignedNurseId ||
      !startDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "icuAdmissionId, patientId, problem, goal, intervention, frequency, assignedNurseId and startDate are required",
      });
    }

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        doctorId:hospitalId,
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const icuAdmission = await ICUAdmission.findOne({
      where: {
        id: icuAdmissionId,
        hospitalId,
        patientId,
      },
    });

    if (!icuAdmission) {
      return res.status(404).json({
        success: false,
        message: "ICU admission not found for this patient",
      });
    }

    if (
      ["DISCHARGED", "CANCELLED","TRANSFERRED"].includes(
        String(icuAdmission.status).toUpperCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: `ICU admission is already ${icuAdmission.status}, so care paln cannot be added`,
      });
    }

    const nurse = await Receptionist.findOne({
      where: {
        id: assignedNurseId,
        doctorId:hospitalId,
        role: "nurse",
      },
    });

    if (!nurse) {
      return res.status(404).json({
        success: false,
        message: "Assigned nurse not found",
      });
    }

    if (
      reviewDate &&
      new Date(reviewDate) < new Date(startDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "reviewDate cannot be before startDate",
      });
    }

    const createdBy =
      ["doctor", "subDoctor"].includes(req.user.role)
        ? req.user.id
        : req.user.receptionistId;

    const createdByRole = req.user.role;

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "Unable to identify the user who created the care plan",
      });
    }

    const carePlan = await ICUCarePlan.create({
      hospitalId,

      icuAdmissionId,
      patientId,
      patientUniqueId: patient.patientId,

      problem: problem.trim(),
      goal: goal.trim(),
      intervention: intervention.trim(),
      frequency: frequency.trim(),

      assignedNurseId,

      startDate,
      reviewDate: reviewDate || null,

      status: "ACTIVE",

      createdBy,
      createdByRole,
    });

    return res.status(201).json({
      success: true,
      message: "ICU care plan added successfully",
      data: carePlan,
    });
  } catch (error) {
    console.error("Add ICU Care Plan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add ICU care plan",
      error: error.message,
    });
  }
};

exports.getLatestICUCarePlan = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { searchTerm , startDate } = req.query;

    const where = {
      hospitalId,
    };

    if (startDate) {
      const date = startDate.substring(0, 10);

      where.startDate = {
        [Op.gte]: `${date} 00:00:00`,
        [Op.lt]: `${date} 23:59:59`,
      };
    }

    const carePlans = await ICUCarePlan.findAll({
      where,
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: [
            "id",
            "patientId",
            "name",
            "mobileNumber",
            "gender",
            "age",
            "email",
          ],
        },
        {
          model: ICUAdmission,
          as: "icuAdmission",
          attributes: [
            "id",
            "icuAdmissionNumber",
            "admissionDate",
            "admissionTime",
            "status",
          ],
        },
        {
          model: Receptionist,
          as: "assignedNurse",
          attributes: [
            "id",
            "name",
            "receptionistId",
          ],
          required: false,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    let filteredData = carePlans.map((item) => {
      const data = item.toJSON();

      if (data.patient) {
        data.patient.name = data.patient.name
          ? decrypt(data.patient.name)
          : "";

        data.patient.email = data.patient.email
          ? decrypt(data.patient.email)
          : "";

        data.patient.mobileNumber = data.patient.mobileNumber
          ? decrypt(data.patient.mobileNumber)
          : "";
      }

      if (data.assignedNurse) {
        data.assignedNurse.name = data.assignedNurse.name
          ? decrypt(data.assignedNurse.name)
          : "";
      }

      return data;
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      filteredData = filteredData.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;
        const nurse = item.assignedNurse;

        return (
          patient?.name
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.patientId
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.mobileNumber
            ?.toLowerCase()
            .includes(keyword) ||

          patient?.email
            ?.toLowerCase()
            .includes(keyword) ||

          admission?.icuAdmissionNumber
            ?.toLowerCase()
            .includes(keyword) ||

          nurse?.name
            ?.toLowerCase()
            .includes(keyword) ||

          nurse?.receptionistId
            ?.toLowerCase()
            .includes(keyword)
            
        );
      });
    }

    const latestCarePlanMap = new Map();

    filteredData.forEach((carePlan) => {
      const key = `${carePlan.patientId}_${carePlan.icuAdmissionId}`;

      if (!latestCarePlanMap.has(key)) {
        latestCarePlanMap.set(key, carePlan);
      }
    });


    const latestcarePlans = Array.from(
      latestCarePlanMap.values()
    );

    return res.status(200).json({
      success: true,
      message: "ICU carePlans fetched successfully",
      data: latestcarePlans,
    });
  } catch (error) {
    console.error("Get Latest ICU carePlans Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ICU carePlans",
      error: error.message,
    });
  }
};

exports.getICUCarePlans = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const { patientId, icuAdmissionId } = req.params;

    const { startDate } = req.query;

    if (!patientId || !icuAdmissionId) {
      return res.status(400).json({
        success: false,
        message: "patientId and icuAdmissionId are required",
      });
    }

    const patient = await Patient.findOne({
      where: {
        id: patientId,
        doctorId:hospitalId,
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const icuAdmission = await ICUAdmission.findOne({
      where: {
        id: icuAdmissionId,
        hospitalId,
        patientId,
      },
    });

    if (!icuAdmission) {
      return res.status(404).json({
        success: false,
        message: "ICU admission not found for this patient",
      });
    }

     const where = {
        hospitalId,
        patientId,
        icuAdmissionId,
      };

    if (startDate) {
      const date = startDate.substring(0, 10);

      where.startDate = {
        [Op.gte]: `${date} 00:00:00`,
        [Op.lt]: `${date} 23:59:59`,
      };
    }

    const carePlans = await ICUCarePlan.findAll({
      where,
      include:[
        {
          model: Receptionist,
          as: "assignedNurse",
          attributes: [
            "id",
            "name",
            "receptionistId",
          ],
          required: false,
        },

        {
          model: ICUAdmission,
          as: "icuAdmission",
          attributes: [
            "id",
            "icuAdmissionNumber",
            "ipdAdmissionId",
          ],
          required: false,
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    carePlans.forEach((data) => {
      if (!data.createdBy) return;

      if (data.createdByRole === "doctor") {
        doctorIds.push(data.createdBy);
      } else if (data.createdByRole === "subDoctor") {
        subDoctorIds.push(data.createdBy);
      }else {
        receptionistIds.push(data.createdBy);
      }
    });

    const uniqueDoctorIds = [...new Set(doctorIds)];
    const uniqueSubDoctorIds = [...new Set(subDoctorIds)];
    const uniqueReceptionistIds = [...new Set(receptionistIds)];
    
    
    const doctors = uniqueDoctorIds.length
        ? await Doctor.findAll({
            where: {
              id: uniqueDoctorIds,
            },
            attributes: ["id", "name", "email"],
          })
        : [];
    
    const subDoctors = uniqueSubDoctorIds.length
         ? await SubDoctor.findAll({
          where: {
            id: uniqueSubDoctorIds,
          },
          attributes: ["id", "name", "email"],
        })
        : [];;
    
    const receptionists = uniqueReceptionistIds.length
        ? await Receptionist.findAll({
          where: {
            receptionistId: uniqueReceptionistIds 
          },
          attributes: ["id", "name", "email", "receptionistId"],
        })
        : [];
    
    const doctorMap = new Map(
          doctors.map((doctor) => [
            doctor.id,
            {
              id: doctor.id,
              name: decrypt(doctor.name),
              email: doctor.email,
            },
          ])
        );
    
    const subDoctorMap = new Map(
          subDoctors.map((subDoctor) => [
            subDoctor.id,
            {
              id: subDoctor.id,
              name: decrypt(subDoctor.name),
              email: subDoctor.email,
            },
          ])
        );
    
    const receptionistMap = new Map(
          receptionists.map((receptionist) => [
            receptionist.receptionistId,
            {
              id: receptionist.id,
              name: decrypt(receptionist.name),
              email: receptionist.email,
              receptionistId: receptionist.receptionistId,
            },
          ])
        );

    const formattedCarePlans = carePlans.map((data) => {
          const carePlan = data.toJSON();

          if (carePlan.assignedNurse) {
                carePlan.assignedNurse.name = carePlan.assignedNurse.name
                ? decrypt(carePlan.assignedNurse.name)
                : "";
          }
    
          let recordedByDetails = null;
    
          if (data.createdByRole === "doctor") {
            recordedByDetails =
               doctorMap.get(Number(data.createdBy)) || null;
          }else if (data.createdByRole === "subDoctor") {
            recordedByDetails =
              subDoctorMap.get(data.createdBy) || null;
          }else {
            recordedByDetails =
              receptionistMap.get(data.createdBy) || null;
          }

          return {
            ...carePlan,
            recordedByDetails,
          };
        });


    return res.status(200).json({
      success: true,
      message: "ICU care plans fetched successfully",
      data: formattedCarePlans,
    });
  } catch (error) {
    console.error("Get ICU Care Plans Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ICU care plans",
      error: error.message,
    });
  }
};

exports.updateICUCarePlanStatus = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const { carePlanId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "ACTIVE",
      "COMPLETED",
      "CANCELLED",
      "INPROCESS",
      "OVER_DUE",
    ];

    if (!carePlanId) {
      return res.status(400).json({
        success: false,
        message: "carePlanId is required",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status`,
      });
    }

    const carePlan = await ICUCarePlan.findOne({
      where: {
        id: carePlanId,
        hospitalId,
      },
    });

    if (!carePlan) {
      return res.status(404).json({
        success: false,
        message: "ICU care plan not found",
      });
    }

    if (carePlan.status === status) {
      return res.status(400).json({
        success: false,
        message: `This care plan is already in ${status} status`,
      });
    }

    if (carePlan.status === "CANCELLED") {
        return res.status(400).json({
            success: false,
            message: "This care plan is already cancelled, so status cannot be changed",
        });
    }

    if (carePlan.status === "COMPLETED") {
        return res.status(400).json({
            success: false,
            message: "This care plan is already COMPLETED, so status cannot be changed",
        });
    }

    if (status === "OVER_DUE") {
        if (!carePlan.reviewDate) {
            return res.status(400).json({
            success: false,
            message:
                "Review date is required before changing the care plan status to OVER_DUE",
            });
        }

        const today = new Date();
    
        if (today <= carePlan.reviewDate) {
            return res.status(400).json({
            success: false,
            message:
                `Care plan cannot be marked as OVER_DUE before or on the review date (${carePlan.reviewDate})`,
            });
        }
    }

    const updateData = { status, }; 

    if (status === "COMPLETED" && !carePlan.reviewDate) { 
        updateData.reviewDate = new Date(); 
    } 

    await carePlan.update(updateData);

    return res.status(200).json({
      success: true,
      message: "ICU care plan status updated successfully",
      data: {
        id: carePlan.id,
        status: carePlan.status,
      },
    });
  } catch (error) {
    console.error("Update ICU Care Plan Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update ICU care plan status",
      error: error.message,
    });
  }
};



