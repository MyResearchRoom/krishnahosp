const { Op } = require("sequelize");
const {
  Bed,
  Doctor,SubDoctor,
  IPDAdmission,
  IPDAccount,
  IPDAccountCharge,
  IPDAccountPayment,
  Patient,
  Room,
  Ward,
  sequelize,
} = require("../models");
const generatePaymentId = require("../utils/generatePaymnetId");
const { decrypt, getDecryptedDocumentAsBase64 } = require("../utils/cryptography");

const getHospitalId = (req) => req.user?.hospitalId;

const includeAdmission = [
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
      "address",
    ],
  },

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
    as: "doctor",
    attributes: ["id", "name","mobileNumber","department","doctorId"],
    required: false,
  },

  {
    model: SubDoctor,
    as: "subDoctor",
    required: false,
    attributes: ["id", "name","mobileNumber","department"],  
  },
];

exports.getAccounts = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { fromDate, toDate, search ,status} = req.query;

    const user=req.user;
    console.log("user",user);
    
  

    const whereClause = {
      hospitalId,
    };

    if (status && status !== "all") {
      whereClause.paymentStatus = status;
    }

    if (fromDate && toDate) {
      whereClause.createdAt = {
        [Op.between]: [
          new Date(`${fromDate}T00:00:00`),
          new Date(`${toDate}T23:59:59`),
        ],
      };
    } else if (fromDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(`${fromDate}T00:00:00`),
      };
    } else if (toDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(`${toDate}T23:59:59`),
      };
    }

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    const admissionWhere = {
      hospitalId,
    };

    if (user.role === "doctor") {
      admissionWhere.doctorId = user.id;
    } else if (user.role === "subDoctor") {
      admissionWhere.subDoctorId = user.id;
    }

    const accounts = await IPDAccount.findAll({
        where: whereClause,

        include: [
            {
              model: IPDAdmission,
              as: "admission",
              required: true,
              where: admissionWhere,
              include: includeAdmission,
            },
        ],

        order: [["createdAt", "DESC"]],
    });


    const accountData = accounts.map((account) => {
    const accountJson = account.toJSON();

    if (account.admission) {
        accountJson.admission = account.admission.toJSON();

        if (account.admission.patient) {
        accountJson.admission.patient =
            account.admission.patient.toJSON();
        }

        if (account.admission.doctor) {
        accountJson.admission.doctor =
            account.admission.doctor.toJSON();
        }

        if (account.admission.subDoctor) {
        accountJson.admission.subDoctor =
            account.admission.subDoctor.toJSON();
        }
    }

    return accountJson;
    });

    let filteredData = accountData;

    if (search) {
      const keyword = search.trim().toLowerCase();

      filteredData = accountData.filter((item) => {
        const patient = item.admission?.patient;

        return (
          patient?.name?.toLowerCase().includes(keyword) ||
          patient?.patientId?.toLowerCase().includes(keyword) ||
          patient?.age?.includes(search) ||
          patient?.mobileNumber?.includes(search) ||
          patient?.gender?.toLowerCase().includes(keyword) 
        );
      });
    }

    return res.status(200).json({
      success: true,
      message: "IPD accounts fetched successfully.",
      data: filteredData,
    });


  } catch (error) {
    console.error("Get IPD accounts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get accounts.",
      error: error.message,
    });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { id } = req.params;

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required.",
      });
    }

    const account = await IPDAccount.findOne({
      where: {
        id,
        hospitalId,
      },

      include: [
        {
          model: IPDAdmission,
          as: "admission",
          include: includeAdmission,
        },
      ],
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "IPD account not found.",
      });
    }

     if (!account.admission.id) {
      return res.status(404).json({
        success: false,
        message: "IPD Admission not found.",
      });
    }

    const accountData = account.toJSON();

    if (account.admission) {
      accountData.admission = account.admission.toJSON();

      if (account.admission.patient) {
        accountData.admission.patient =
          account.admission.patient.toJSON();
      }

      if (account.admission.doctor) {
        accountData.admission.doctor =
          account.admission.doctor.toJSON();
      }

      if (account.admission.subDoctor) {
        accountData.admission.subDoctor =
          account.admission.subDoctor.toJSON();
      }
    }

    return res.status(200).json({
      success: true,
      message: "IPD account fetched successfully.",
      data: accountData,
    });
  } catch (error) {
    console.error("Get IPD account error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get account.",
      error: error.message,
    });
  }
};

exports.addAccountCharges = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const hospitalId = getHospitalId(req);
        const { accountId } = req.params;

        const {charges,discount} = req.body;

        if (!hospitalId) {
          await transaction.rollback();

          return res.status(401).json({
              success: false,
              message: "Hospital ID not found.",
          });
        }

        if (!accountId) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: "Account ID is required.",
            });
        }

        if (!Array.isArray(charges)) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: "At least one charge is required.",
            });
        }

        const account = await IPDAccount.findOne({
            where: {
                id: accountId,
                hospitalId,
            },
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

        if (account.status !== "open") {
        await transaction.rollback();

        return res.status(400).json({
            success: false,
            message: `Cannot add charges to a ${account.status} account.`,
        });
        }

        const chargeData = [];

        for (const charge of charges) {
            if (!charge.chargeName?.trim()) {
                await transaction.rollback();

                return res.status(400).json({
                success: false,
                message: "Charge name is required.",
                });
            }

            if (
                charge.unitPrice === undefined ||
                charge.unitPrice === null ||
                Number.isNaN(Number(charge.unitPrice)) ||
                Number(charge.unitPrice) < 0
            ) {
                await transaction.rollback();

                return res.status(400).json({
                success: false,
                message: `Invalid price for charge: ${charge.chargeName}`,
                });
            }

            const unitPrice = Number(charge.unitPrice);

            chargeData.push({
                accountId: account.id,
                chargeName: charge.chargeName.trim(),
                quantity: 1,
                unitPrice,
                totalAmount: Number(unitPrice.toFixed(2)),
                chargeDate: new Date(),

                remarks: charge?.remarks?.trim() || `Price for ${charge.chargeName.trim()} added`,

                isActive: true,
            });
        }

        await IPDAccountCharge.bulkCreate(
            chargeData,
            {
                transaction,
            }
        );

        const allCharges = await IPDAccountCharge.findAll({
            where: {
                accountId: account.id,
            },
            attributes: ["totalAmount"],
            transaction,
        });

        const totalAmount = Number(
        allCharges
            .reduce(
            (sum, charge) =>
                sum + Number(charge.totalAmount || 0),
            0
            )
            .toFixed(2)
        );

        const existingDiscount = Number(account.discount || 0);
        const paidAmount = Number(account.paidAmount || 0);

        const additionalDiscount = Number(discount || 0);

        if (Number.isNaN(additionalDiscount) || additionalDiscount < 0) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid discount amount.",
            });
        }

        const newDiscount = existingDiscount + additionalDiscount;

        if (newDiscount > totalAmount) {
          await transaction.rollback();

          return res.status(400).json({
              success: false,
              message: "Discount cannot exceed total charges.",
          });
        }

        const netAmount = Number(
        Math.max(
            0,
            totalAmount - newDiscount
        ).toFixed(2)
        );

        const remainingAmount = Number(
        Math.max(
            0,
            netAmount - paidAmount
        ).toFixed(2)
        );

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
            discount:newDiscount
        },
        {
            transaction,
        }
        );

        await transaction.commit();

        return res.status(201).json({
        success: true,
        message: "IPD account charges added successfully.",

        });
    } catch (error) {
        if (transaction && !transaction.finished) {
        await transaction.rollback();
        }

        console.error(
        "Add IPD account charges error:",
        error
        );

        return res.status(500).json({
        success: false,
        message: "Failed to add IPD account charges.",
        error: error.message,
        });
    }
};

exports.getAccountCharges = async (req, res) => {
  try {
    const { accountId } = req.params;
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
        await transaction.rollback();

        return res.status(401).json({
            success: false,
            message: "Hospital ID not found.",
        });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required.",
      });
    }

    const account = await IPDAccount.findOne({
        where: {
            id: accountId,
            hospitalId,
        },
    });

    if (!account) {

        return res.status(404).json({
            success: false,
            message: "IPD account not found.",
        });
    }

    const charges = await IPDAccountCharge.findAll({
      where: {
        accountId,
      },
      order: [
        ["createdAt", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Charges fetched successfully.",
      data: charges,
    });
  } catch (error) {
    console.error("Get account charges error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch charges.",
      error: error.message,
    });
  }
};

exports.getAdmittedPatientsForAccount = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);

    const accounts = await IPDAccount.findAll({
      where: {
        hospitalId,
        status: "open",
      },
      attributes: [
        "id",
        "accountNumber",
        "remainingAmount"
      ],
      include: [
        {
          model: IPDAdmission,
          as: "admission",
          required: true,
          attributes: [
            "id",
            "admissionNumber",
          ],
          include: [
            {
              model: Patient,
              as: "patient",
              attributes: [
                "id",
                "patientId",
                "name",
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const data = accounts.map((account) => ({
      accountId: account.id,
      accountNumber: account.accountNumber,
      dueAmount:account.remainingAmount,

      admissionId: account.admission.id,
      admissionNumber: account.admission.admissionNumber,

      patientId: account.admission.patient.id,
      patientUniqueId: account.admission.patient.patientId,
      patientName: account.admission.patient?.name ? decrypt(account.admission.patient.name) : "",
    }));

    return res.status(200).json({
      success: true,
      message: "Admitted patient accounts fetched successfully.",
      data,
    });
  } catch (error) {
    console.error("Get admitted patient accounts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admitted patient accounts.",
      error: error.message,
    });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { fromDate, toDate, search ,status} = req.query;

    const whereClause = {};

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (fromDate && toDate) {
      whereClause.paymentDate = {
        [Op.between]: [
          new Date(`${fromDate}T00:00:00`),
          new Date(`${toDate}T23:59:59`),
        ],
      };
    } else if (fromDate) {
      whereClause.paymentDate = {
        [Op.gte]: new Date(`${fromDate}T00:00:00`),
      };
    } else if (toDate) {
      whereClause.paymentDate = {
        [Op.lte]: new Date(`${toDate}T23:59:59`),
      };
    }

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    const payments = await IPDAccountPayment.findAll({
      where: whereClause,
      include: [
        {
          model: IPDAccount,
          as: "account",
          required: true,
          attributes: [
            "id",
            "accountNumber",
            "patientId",
            "admissionId",
            "remainingAmount"
          ],
          where: {
            hospitalId,
          },
          include: [
            {
              model: IPDAdmission,
              as: "admission",
              required: false,
              attributes: [
                "id",
                "admissionNumber",
                "patientId",
                "admissionDate",
                "status",
                "dischargedAt",
              ],
            },
            {
              model: Patient,
              as: "patient",
              required: false,
              attributes: [
                "id",
                "name",
                "patientId",
                "mobileNumber",
                "age",
                "gender",
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const doctor = await Doctor.findOne({
      where: {
        id:hospitalId,
      },
      attributes: ["logo", "logoContentType"],
    });

    const paymentData = payments.map((payment) => {
        const paymentJson = payment.toJSON();

        if (payment.account?.patient) {
            paymentJson.account.patient =
            payment.account.patient.toJSON();
        }

        if (payment.account?.admission) {
            paymentJson.account.admission =
            payment.account.admission.toJSON();
        }

        paymentJson.logo = getDecryptedDocumentAsBase64(doctor.logo);

        return paymentJson;
    });

    let filteredData = paymentData;

    if (search) {
      const keyword = search.trim().toLowerCase();

      filteredData = paymentData.filter((item) => {
        const patient = item.account?.patient;
        const payment = item;

        return (
          patient?.name?.toLowerCase().includes(keyword) ||
          patient?.patientId?.toLowerCase().includes(keyword) ||
          patient?.age?.includes(search) ||
          patient?.mobileNumber?.includes(search) ||
          patient?.gender?.toLowerCase().includes(keyword) ||

          payment?.paymentNumber?.toLowerCase().includes(keyword) ||
          payment?.paymentMode.toLowerCase().includes(keyword)
          
        );
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully.",
      data: filteredData,
    });
  } catch (error) {
    console.error("Get account payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments.",
      error: error.message,
    });
  }
};

exports.getPaymentsByAccountAndPatient = async (req, res) => {
  try {
    const { accountId, patientId, paymentId } = req.params;
    const hospitalId = getHospitalId(req);

    if (!hospitalId) {
      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required.",
      });
    }

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required.",
      });
    }

    const account = await IPDAccount.findOne({
      where: {
        id: accountId,
        patientId,
        hospitalId,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "IPD account not found for this patient.",
      });
    }

    const payment = await IPDAccountPayment.findOne({
      where: {
        accountId,
        id:paymentId,
      },
      include: [
        {
          model: IPDAccount,
          as: "account",
          required: true,
          attributes: [
            "id",
            "accountNumber",
            "patientId",
            "admissionId",
          ],
          where: {
            hospitalId,
            patientId,
          },
          include: [
            {
              model: IPDAdmission,
              as: "admission",
              required: false,
              attributes: [
                "id",
                "admissionNumber",
                "patientId",
                "admissionDate",
                "status",
                "doctorId",
                "subDoctorId"
              ],
              include:[
                {
                  model: Doctor,
                  as: "doctor",
                  attributes: ["id", "name","mobileNumber","department","doctorId"],
                  required: false,
                },

                {
                  model: SubDoctor,
                  as: "subDoctor",
                  required: false,
                  attributes: ["id", "name","mobileNumber","department"],  
                },
              ]
            },
            {
                model:Patient,
                as:"patient",
                required:false,
                attributes:[
                    "id",
                    "name",
                    "patientId",
                    "mobileNumber",
                    "age",
                    "gender",
                    "address",
                ]
            }
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });


    const paymentJson = payment.toJSON();

    const patient = payment.account?.patient?.toJSON();
    const doctor = payment.account?.admission?.doctor?.toJSON();
    const subDoctor = payment.account?.admission?.subDoctor?.toJSON();

    const selectedDoctor = doctor || subDoctor;

    const responseData = {
      name: patient?.name || null,
      patientId: patient?.patientId || null,
      mobileNumber: patient?.mobileNumber || null,
      age: patient?.age || null,
      gender: patient?.gender || null,
      address: patient?.address || null,


      doctorName: selectedDoctor?.name || null,
      doctorDepartment: selectedDoctor?.department || null,

      id: paymentJson.id,
      paymentNumber: paymentJson.paymentNumber,
      accountId: paymentJson.accountId,
      amount: paymentJson.amount,
      paymentDate: paymentJson.paymentDate,
      paymentMode: paymentJson.paymentMode,
      status: paymentJson.status,
      notes: paymentJson.remarks,
      createdAt: paymentJson.createdAt,
      updatedAt: paymentJson.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully.",
      data: responseData,
    });
  } catch (error) {
    console.error("Get account payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments.",
      error: error.message,
    });
  }
};

exports.addAccountPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

    try {
        const hospitalId = getHospitalId(req);
        const { accountId } = req.params;

        const {
          amount,
          paymentMode,
          paymentDate,
          remarks,
        } = req.body;

        if (!hospitalId) {
        await transaction.rollback();

        return res.status(401).json({
            success: false,
            message: "Hospital ID not found.",
        });
        }

        if (!accountId) {
        await transaction.rollback();

        return res.status(400).json({
            success: false,
            message: "Account ID is required.",
        });
        }

        if (
        amount === undefined ||
        amount === null ||
        Number.isNaN(Number(amount)) ||
        Number(amount) <= 0
        ) {
        await transaction.rollback();

        return res.status(400).json({
            success: false,
            message: "Valid payment amount is required.",
        });
        }

        const validPaymentModes = [
            "cash",
            "card",
            "upi",
            "cheque",
            "bank_transfer",
            "insurance",
        ];

        if (!paymentMode || !validPaymentModes.includes(paymentMode)) {
        await transaction.rollback();

        return res.status(400).json({
            success: false,
            message: "Valid payment mode is required.",
            allowedModes: validPaymentModes,
        });
        }

        const paymentAmount = Number(Number(amount).toFixed(2));

        const account = await IPDAccount.findOne({
            where: {
                id: accountId,
                hospitalId,
            },
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

        if (account.status !== "open") {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: `Cannot add payment to a ${account.status} account.`,
            });
        }

        const totalAmount = Number(account.totalAmount || 0);
        const discount = Number(account.discount || 0);
        const currentPaidAmount = Number(account.paidAmount || 0);

        const netAmount = Math.max(
        0,
        Number((totalAmount - discount).toFixed(2))
        );

        const currentRemainingAmount = Math.max(
        0,
        Number((netAmount - currentPaidAmount).toFixed(2))
        );

        if (paymentAmount > currentRemainingAmount) {
        await transaction.rollback();

        return res.status(400).json({
            success: false,
            message: "Payment amount cannot be greater than remaining amount.",
            remainingAmount: currentRemainingAmount,
        });
        }

        const paymentNumber = await generatePaymentId(IPDAccountPayment,transaction);

        await IPDAccountPayment.create(
        {
            accountId: account.id,
            paymentNumber,
            amount: paymentAmount,
            paymentMode,
            paymentDate: paymentDate
            ? new Date(paymentDate)
            : new Date(),
            remarks: remarks?.trim() || null,
            status: "completed",
        },
        { transaction }
        );
    
        const newPaidAmount = Number(
        (currentPaidAmount + paymentAmount).toFixed(2)
        );

    
        const remainingAmount = Math.max(
        0,
        Number((netAmount - newPaidAmount).toFixed(2))
        );

        let paymentStatus = "pending";

        if (newPaidAmount >= netAmount && netAmount > 0) {
        paymentStatus = "paid";
        } else if (newPaidAmount > 0) {
        paymentStatus = "partial";
        }

        await account.update(
        {
            paidAmount: newPaidAmount,
            remainingAmount,
            paymentStatus,
        },
        { transaction }
        );

        await transaction.commit();

        return res.status(201).json({
        success: true,
        message: "IPD account payment added successfully.",
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
        await transaction.rollback();
        }

        console.error("Add IPD account payment error:", error);

        return res.status(500).json({
        success: false,
        message: "Failed to add IPD account payment.",
        error: error.message,
        });
    }
};

exports.updateAccountPaymentByPaymentId = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const hospitalId = getHospitalId(req);
    const { accountId, paymentId } = req.params;

    const {
      amount,
      paymentMode,
      paymentDate,
      remarks,
    } = req.body;

    if (!hospitalId) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Hospital ID not found.",
      });
    }

    if (!accountId || !paymentId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Account ID and Payment ID are required.",
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      Number.isNaN(Number(amount)) ||
      Number(amount) <= 0
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required.",
      });
    }

    const validPaymentModes = [
      "cash",
      "card",
      "upi",
      "cheque",
      "bank_transfer",
      "insurance",
    ];

    if (!paymentMode || !validPaymentModes.includes(paymentMode)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid payment mode is required.",
        allowedModes: validPaymentModes,
      });
    }

    const paymentAmount = Number(Number(amount).toFixed(2));

    // Check account
    const account = await IPDAccount.findOne({
      where: {
        id: accountId,
        hospitalId,
      },
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

    if (account.status !== "open") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot edit payment for a ${account.status} account.`,
      });
    }

    // Check payment belongs to account
    const payment = await IPDAccountPayment.findOne({
      where: {
        id: paymentId,
        accountId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment not found for this account.",
      });
    }

    const totalAmount = Number(account.totalAmount || 0);
    const discount = Number(account.discount || 0);

    const netAmount = Math.max(
      0,
      Number((totalAmount - discount).toFixed(2))
    );

    const oldPaymentAmount = Number(payment.amount || 0);

    // Remove old payment and add new payment
    const newPaidAmount = Number(
      (
        Number(account.paidAmount || 0) -
        oldPaymentAmount +
        paymentAmount
      ).toFixed(2)
    );

    if (newPaidAmount > netAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot exceed remaining amount.",
      });
    }

    const remainingAmount = Math.max(
      0,
      Number((netAmount - newPaidAmount).toFixed(2))
    );

    let paymentStatus = "pending";

    if (newPaidAmount >= netAmount && netAmount > 0) {
      paymentStatus = "paid";
    } else if (newPaidAmount > 0) {
      paymentStatus = "partial";
    }

    await payment.update(
      {
        amount: paymentAmount,
        paymentMode,
        paymentDate: paymentDate
          ? new Date(paymentDate)
          : payment.paymentDate,
        remarks: remarks?.trim() || null,
      },
      { transaction }
    );

    await account.update(
      {
        paidAmount: newPaidAmount,
        remainingAmount,
        paymentStatus,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Payment updated successfully.",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Update payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update payment.",
      error: error.message,
    });
  }
};

exports.getPaymentsByAdmissionId = async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { admissionId } = req.params;

    if (!admissionId) {
      return res.status(400).json({
        success: false,
        message: "Admission ID is required.",
      });
    }

    const payments = await IPDAccountPayment.findAll({
      include: [
        {
          model: IPDAccount,
          as: "account",
          required: true,
          where: {
            admissionId,
            hospitalId,
          },
          attributes: [
            "id",
            "accountNumber",
            "admissionId",
            "patientId",
            "patientUniqueId",
            "hospitalId",
          ],
        },
      ],
      order: [["paymentDate", "DESC"]],
    });

    const doctor = await Doctor.findOne({
      where: {
        id:hospitalId,
      },
      attributes: ["logo", "logoContentType"],
    });

    const paymentsWithLogo = payments.map((payment) => {
      const paymentData = payment.toJSON();

      return {
        ...paymentData,
        logo: getDecryptedDocumentAsBase64(doctor.logo),
      };
    });

    return res.status(200).json({
      success: true,
      payments: paymentsWithLogo,
    });
  } catch (error) {
    console.error("Error getting payments by admission ID:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get payments.",
    });
  }
};