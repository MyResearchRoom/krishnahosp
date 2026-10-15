const jwt = require("jsonwebtoken");
const { Doctor, Receptionist, SubDoctor } = require("../models");

exports.authenticate = (roles = []) => {
  return async (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log("decoded",decoded);
      

      if (
        decoded.role === "doctor" &&
        decoded.acceptedTAndC === false &&
        req.originalUrl !== "/api/doctors/accept-terms-and-conditions"
      ) {
        return res.status(401).json({
          error: "Access denied. You have not accepted the terms & conditions.",
        });
      }

      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({
          error:
            "Access denied. You do not have permission to access this resource.",
        });
      }

      let user = null;
      if (decoded.role === "doctor") {
        user = await Doctor.findOne({
          where: { id: decoded.id },
          attributes: ["id", "name", "email", "mobileNumber","department"],
        });
      } else if (decoded.role === "subDoctor") {
        user = await SubDoctor.findOne({
          where: { id: decoded.id },
          attributes: [
            "id",
            "name",
            "email",
            "mobileNumber",
            "isActive",
            "addedBy",
            "department",
          ],
        });
      } else {
        user = await Receptionist.findOne({
          where: { id: decoded.id },
          attributes: ["id", "name", "email", "mobileNumber", "doctorId","role","receptionistId"],
        });
      } 
      // console.log("user",user);
      

      if (!user) {
        return res
          .status(401)
          .json({ error: "Invalid token. User not found." });
      }

      if (decoded.role === "subDoctor" && user.isActive === false) {
        return res.status(403).json({
          error:
            "Access denied. Your account is inactive. Please contact the doctor.",
        });
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
      console.log(error);
      
      return res.status(400).json({
        message: "Invalid Or expired token, please login again.",
      });
    }
  };
};
