const cron = require("node-cron");

const {
  IPDAdmission,
  IPDAccount,
  IPDAccountCharge,
} = require("../models");

const updateIPDBedCharges = async () => {
  try {
    console.log("Starting IPD bed charge update...");

    const admissions = await IPDAdmission.findAll({
      where: {
        status: "admitted",
      },
      include: [
        {
          model: IPDAccount,
          as: "account",
          where: {
            status: "open",
          },
          required: true,
        },
      ],
    });

    console.log("Admissions:", admissions.length);

    const today = new Date();

    for (const admission of admissions) {
      try {
        const account = admission.account;

        if (!account) {
          continue;
        }

        const bedCharge = await IPDAccountCharge.findOne({
          where: {
            accountId: account.id,
            chargeName: "Bed Charge",
            isActive: true,
          },
          order: [["id", "DESC"]],
        });

        if (!bedCharge) {
          console.log(
            `No active bed charge found for account ${account.id}`
          );
          continue;
        }

        const chargeStartDate = new Date(bedCharge.chargeDate);

        const startDate = new Date(
          chargeStartDate.getFullYear(),
          chargeStartDate.getMonth(),
          chargeStartDate.getDate()
        );

        const currentDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        // Calculate number of calendar days
        const differenceInTime =
          currentDate.getTime() - startDate.getTime();

        const days =
          Math.floor(
            differenceInTime / (1000 * 60 * 60 * 24)
          ) + 1;

        const quantity = Math.max(1, days);

        const unitPrice = Number(
          bedCharge.unitPrice || 0
        );

        const totalAmount = Number(
          (quantity * unitPrice).toFixed(2)
        );

        // Update ONLY active bed charge
        await bedCharge.update({
          quantity,
          totalAmount,
        });


        const charges = await IPDAccountCharge.findAll({
          where: {
            accountId: account.id,
          },
        });

        const totalAmountFromCharges =
          charges.reduce(
            (sum, charge) =>
              sum + Number(charge.totalAmount || 0),
            0
          );

        const paidAmount = Number(
          account.paidAmount || 0
        );

        const discount = Number(
          account.discount || 0
        );

        const netAmount = Math.max(
          0,
          totalAmountFromCharges - discount
        );

        const remainingAmount = Math.max(
          0,
          netAmount - paidAmount
        );

        let paymentStatus = "pending";

        if (
          paidAmount >= netAmount &&
          netAmount > 0
        ) {
          paymentStatus = "paid";
        } else if (paidAmount > 0) {
          paymentStatus = "partial";
        }

        await account.update({
          totalAmount: totalAmountFromCharges,
          remainingAmount,
          paymentStatus,
        });

      } catch (error) {
        console.error(
          `Failed to update bed charge for admission ${admission.id}:`,
          error
        );
      }
    }

    console.log("IPD bed charge update completed.");
  } catch (error) {
    console.error(
      "IPD bed charge job failed:",
      error
    );
  }
};


cron.schedule(
  "* * * * *",
  updateIPDBedCharges,
  {
    timezone: "Asia/Kolkata",
  }
);

// Use this in production:
// cron.schedule(
//   "0 0 * * *",
//   updateIPDBedCharges,
//   {
//     timezone: "Asia/Kolkata",
//   }
// );

module.exports = {
  updateIPDBedCharges,
};