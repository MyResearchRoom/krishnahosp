const generatePaymentId = async (
  Model,
  transaction = null
) => {
  const lastPayment = await Model.findOne({
    order: [["id", "DESC"]],
    attributes: ["id"],
    transaction,
  });

  const nextNumber = (lastPayment?.id || 0) + 1;

  return `PAY-${String(nextNumber).padStart(6, "0")}`;
};

module.exports = generatePaymentId;