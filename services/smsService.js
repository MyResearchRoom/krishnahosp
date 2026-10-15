// // services/smsService.js
// // Sends appointment reminder SMS via MSG91's free-tier transactional API.
// // Free tier: MSG91 gives free trial SMS credits on signup (no card required
// // for the trial). Beyond the trial credits it becomes paid — there is no
// // vendor that sends unlimited real SMS for free forever, since carriers
// // charge for SMS delivery. This is the closest "free" option available.
// //
// // IMPORTANT (India-specific): You MUST complete DLT registration with your
// // telecom operator before sending any transactional/promotional SMS in
// // India. Without DLT, carriers will silently block your messages even if
// // MSG91 accepts the request. See setup notes below.

// const axios = require("axios");

// const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
// const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID; // 6-char DLT-approved sender ID
// const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID; // DLT-approved template ID

// /**
//  * Sends an appointment reminder SMS.
//  * Never throws — always resolves with a { success, ... } object so it can
//  * never break the calling controller's response flow.
//  */
// const sendAppointmentReminderSMS = async ({
//   mobileNumber,
//   patientName,
//   date,
//   appointmentTime,
// }) => {
//   if (!MSG91_AUTH_KEY || !MSG91_SENDER_ID || !MSG91_TEMPLATE_ID) {
//     console.warn(
//       "[smsService] Skipped sending SMS — MSG91 credentials missing in .env"
//     );
//     return { success: false, reason: "missing_credentials" };
//   }

//   if (!mobileNumber) {
//     console.warn("[smsService] Skipped sending SMS — no mobile number provided");
//     return { success: false, reason: "missing_mobile_number" };
//   }

//   try {
//     const response = await axios.post(
//       "https://control.msg91.com/api/v5/flow/",
//       {
//         template_id: MSG91_TEMPLATE_ID,
//         short_url: "0",
//         recipients: [
//           {
//             mobiles: `91${mobileNumber}`, // country code + 10-digit number
//             VAR1: patientName || "Patient",
//             VAR2: date || "",
//             VAR3: appointmentTime || "",
//           },
//         ],
//       },
//       {
//         headers: {
//           authkey: MSG91_AUTH_KEY,
//           "Content-Type": "application/json",
//         },
//         timeout: 8000,
//       }
//     );

//     return { success: true, data: response.data };
//   } catch (error) {
//     // Logged, not thrown — a failed reminder SMS should never fail
//     // patient registration / appointment booking.
//     console.error(
//       "[smsService] Failed to send reminder SMS:",
//       error?.response?.data || error.message
//     );
//     return { success: false, error: error?.response?.data || error.message };
//   }
// };

// module.exports = { sendAppointmentReminderSMS };
