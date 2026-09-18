const generateAccountNumber = async (IPDAccount, hospitalId, transaction) => {
  const prefix = "IPD";

  const lastAccount = await IPDAccount.findOne({
    where: {
      hospitalId,
    },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });

  let nextNumber = 1;

  if (lastAccount?.accountNumber) {
    const match = lastAccount.accountNumber.match(/(\d+)$/);

    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(6, "0")}`;
};

module.exports = generateAccountNumber;