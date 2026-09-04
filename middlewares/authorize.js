const jwt = require("jsonwebtoken");
const { Doctor, Receptionist } = require("../models");

const authorize = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (
      decoded.role === "doctor" &&
      decoded.acceptedTAndC === false &&
      req.originalUrl !== "/api/doctors/accept-terms-and-conditions"
    ) {
      return res.status(401).json({
        error: "Access denied. You have not accepted the terms & conditions.",
      });
    }

    let user = null;
    if (decoded.role === "doctor") {
      user = await Doctor.findOne({
        where: { id: decoded.id },
        attributes: ["id", "name", "email", "mobileNumber",],
      });
    } else if (decoded.role === "receptionist") {
      user = await Receptionist.findOne({
        where: { id: decoded.id },
        attributes: ["id", "name", "email", "mobileNumber"],
      });
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid token. User not found." });
    }

    if (decoded.role === "doctor" && user.accountStatus === "suspended") {
      return res.status(403).json({
        error: "Access denied. Your hospital account has been suspended.",
      });
    }

    req.user = {
      ...user.toJSON(),
      role: decoded.role,
      hospitalId: decoded.hospitalId,
    };

    next();
  } catch (error) {
    return res.status(400).json({
      message: "Invalid Or expired token, please login again.",
    });
  }
};

module.exports = authorize;
