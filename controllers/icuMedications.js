const { Op } = require("sequelize");

const { ICUMedication, ICUAdmission, Patient,Receptionist,Doctor,SubDoctor} = require("../models");
const { decrypt } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

exports.addICUMedication = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const {
      icuAdmissionId,
      patientId,
      medicineName,
      dose,
      route,
      frequency,
      startDate,
      endDate,
      instructions,
    } = req.body;

    if (
      !icuAdmissionId ||
      !patientId ||
      !medicineName ||
      !dose ||
      !route ||
      !frequency ||
      !startDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "icuAdmissionId, patientId, medicineName, dose, route, frequency and startDate are required",
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
        patientId: patientId,
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
        message: `ICU admission is already ${icuAdmission.status}, so medication cannot be added`,
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
        message: "Unable to identify the user who added the medication",
      });
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "endDate cannot be before startDate",
      });
    }

    await ICUMedication.create({
      hospitalId,
      icuAdmissionId,
      patientId,
      patientUniqueId:patient.patientId,

      medicineName: medicineName.trim(),
      dose: dose.trim(),
      route: route.trim(),
      frequency: frequency.trim(),

      startDate,
      endDate: endDate || null,

      createdBy,

      createdByRole,

      status: "ACTIVE",

      instructions: instructions
        ? instructions.trim()
        : null,
    });

    return res.status(201).json({
      success: true,
      message: "ICU medication added successfully",
    });
  } catch (error) {
    console.error("Add ICU Medication Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add ICU medication",
      error: error.message,
    });
  }
};

exports.getLatestICUMedications = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { searchTerm ,startDate} = req.query;
     console.log("seachterm",searchTerm);
    

    const where = {
      hospitalId,
    };

    if(startDate){
      where.startDate=startDate;
    }
    const medications = await ICUMedication.findAll({
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
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    let filteredData = medications.map((item) => {
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


      return data;
    });

    if (searchTerm?.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      filteredData = filteredData.filter((item) => {
        const patient = item.patient;
        const admission = item.icuAdmission;

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
            .includes(keyword)
            
        );
      });
    }

    const latestMedicationsMap = new Map();

    filteredData.forEach((medication) => {
      const key = `${medication.patientId}_${medication.icuAdmissionId}`;

      if (!latestMedicationsMap.has(key)) {
        latestMedicationsMap.set(key, medication);
      }
    });

    const latestMedications = Array.from(
      latestMedicationsMap.values()
    );

    return res.status(200).json({
      success: true,
      message: "ICU medications fetched successfully",
      data: latestMedications,
    });
  } catch (error) {
    console.error("Get Latest ICU Medications Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ICU medications",
      error: error.message,
    });
  }
};

exports.getICUMedications = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const { patientId, icuAdmissionId  } = req.params;

    const {startDate } = req.query;

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

    if(startDate){
      where.startDate=startDate;
    }

    const medications = await ICUMedication.findAll({
      where,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    const doctorIds = [];
    const subDoctorIds = [];
    const receptionistIds = [];

    medications.forEach((data) => {
      if (!data.createdBy) return;

      if (data.createdByRole === "doctor") {
        doctorIds.push(data.createdBy);
      } else if (data.createdByRole === "subDoctor") {
        subDoctorIds.push(data.createdBy);
      } else {
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
    
    const formattedmedications = medications.map((data) => {
          const medicationsData = data.toJSON();
    
          let recordedByDetails = null;
    
          if (data.createdByRole === "doctor") {
            recordedByDetails =
               doctorMap.get(Number(data.createdBy)) || null;
          } else if (data.createdByRole === "subDoctor") {
            recordedByDetails =
              subDoctorMap.get(data.createdBy) || null;
          } else {
            recordedByDetails =
              receptionistMap.get(data.createdBy) || null;
          }

          return {
            ...medicationsData,
            recordedByDetails,
          };
        });

    return res.status(200).json({
      success: true,
      message: "Patient ICU medications fetched successfully",
      data: formattedmedications,
    });
  } catch (error) {
    console.error("Get ICU Medications Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ICU medications",
      error: error.message,
    });
  }
};









