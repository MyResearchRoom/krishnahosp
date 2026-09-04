const { DoctorTimeSlot, Appointment } = require("../models");

exports.checkDoctorAvailability = async (
  doctorId,
  subDoctorId,
  date,
  appointmentTime
) => {
  try {
    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay();

    const whereClause = {
      ...(doctorId ? { doctorId } : {}),
      ...(subDoctorId ? { subDoctorId } : {}),
    };

    const slots = await DoctorTimeSlot.findAll({ where: whereClause });

    if (!slots || slots.length === 0) {
      const appointmentCount = await Appointment.count({
        where: {
          ...(doctorId ? { doctorId } : {}),
          ...(subDoctorId ? { subDoctorId } : {}),
          date: appointmentDate,
          appointmentTime,
        },
      });
      return { available: true, appointmentCount };
    }

    const parts = appointmentTime ? appointmentTime.split(" - ") : [];
    const startTime = parts[0] || appointmentTime;
    const endTime = parts[1] || null;

    let slot = slots.find((s) => {
      if (endTime) {
        return s.startTime === startTime && s.endTime === endTime;
      }
      return (
        s.startTime === startTime ||
        (s.startTime <= startTime && s.endTime >= startTime)
      );
    });

    if (!slot) {
      slot = slots[0];
    }

    if (slot && slot.availabilityIds && Array.isArray(slot.availabilityIds) && slot.availabilityIds.length > 0) {
      if (!slot.availabilityIds.includes(dayOfWeek)) {
        return {
          available: false,
          reason: "Doctor is not available on this day",
        };
      }
    }

    const appointmentCount = await Appointment.count({
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(subDoctorId ? { subDoctorId } : {}),
        date: appointmentDate,
        appointmentTime,
      },
    });

    if (slot && slot.maxCapacity && appointmentCount >= slot.maxCapacity) {
      return { available: false, reason: "Slot capacity full" };
    }

    return {
      available: true,
      slot,
      appointmentCount,
    };
  } catch (err) {
    console.error("[checkDoctorAvailability Error]:", err);
    return { available: true, appointmentCount: 0 };
  }
};
