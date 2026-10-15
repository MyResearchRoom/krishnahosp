// services/appointmentReminderService.js
// Sends appointment reminder emails by reusing the existing Nodemailer
// transporter already configured in your project for OTP/verification
// emails — no second SMTP connection created, no new dependency needed.

const { transporter } = require("./emailService"); // confirmed: same services/ folder as your existing emailService.js

const EMAIL_FROM = process.env.EMAIL;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Hospital Management System";

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
};

/**
 * Sends an appointment reminder email.
 * Never throws — always resolves with a { success, ... } object so it can
 * never break the calling controller's response flow.
 */
const sendAppointmentReminderEmail = async ({
  toEmail,
  patientName,
  date,
  appointmentTime,
  reason,
}) => {
  if (!EMAIL_FROM || !process.env.EMAIL_PASSWORD) {
    console.warn(
      "[reminderEmailService] Skipped sending email — EMAIL / EMAIL_PASSWORD missing in .env"
    );
    return { success: false, reason: "missing_credentials" };
  }

  if (!toEmail) {
    console.warn("[reminderEmailService] Skipped sending email — no email address provided");
    return { success: false, reason: "missing_email" };
  }

  const formattedDate = formatDate(date);

  try {
    const info = await transporter.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
      to: toEmail,
      subject: "Appointment Reminder",
      text: `Dear ${patientName || "Patient"},\n\nThis confirms your appointment on ${formattedDate} at ${appointmentTime}${
        reason ? ` for ${reason}` : ""
      }.\n\nPlease arrive 10 minutes early.\n\n- ${EMAIL_FROM_NAME}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background:#521785; color:#fff; padding:16px 20px;">
            <h2 style="margin:0; font-size:18px;">Appointment Reminder</h2>
          </div>
          <div style="padding:20px; color:#111827;">
            <p>Dear ${patientName || "Patient"},</p>
            <p>This confirms your appointment:</p>
            <ul style="line-height:1.8;">
              <li><strong>Date:</strong> ${formattedDate}</li>
              <li><strong>Time:</strong> ${appointmentTime}</li>
              ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ""}
            </ul>
            <p>Please arrive 10 minutes early.</p>
            <p style="color:#6b7280; font-size:13px; margin-top:24px;">- ${EMAIL_FROM_NAME}</p>
          </div>
        </div>
      `,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[reminderEmailService] Failed to send reminder email:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendAppointmentReminderEmail };