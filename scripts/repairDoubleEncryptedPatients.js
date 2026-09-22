const { Patient, sequelize } = require("../models");
const { decrypt } = require("../utils/cryptography");

const ENCRYPT_FIELDS = [
  "name",
  "email",
  "mobileNumber",
  "address",
  "dateOfBirth",
  "referredBy",
];

const CIPHERTEXT_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+$/i;

const looksLikeCiphertext = (value) =>
  typeof value === "string" && CIPHERTEXT_PATTERN.test(value);

async function run() {
  const apply = process.argv.includes("--apply");

  console.log(
    apply
      ? "Running in APPLY mode — changes WILL be written to the database.\n"
      : "Running in DRY-RUN mode — no changes will be written. Pass --apply to fix rows.\n"
  );

  const rows = await Patient.findAll({ raw: true });

  let totalPatients = rows.length;
  let affectedPatients = 0;
  let fixedFieldCount = 0;

  for (const row of rows) {
    const updates = {};

    for (const field of ENCRYPT_FIELDS) {
      const storedValue = row[field];
      if (!storedValue) continue;

      let innerValue;
      try {
        innerValue = decrypt(storedValue);
      } catch (err) {
        console.warn(
          `  [id=${row.id}] Could not decrypt "${field}" at all — skipping this field (raw: ${storedValue}). Error: ${err.message}`
        );
        continue;
      }

      if (looksLikeCiphertext(innerValue)) {
        updates[field] = innerValue;
      }
    }

    if (Object.keys(updates).length > 0) {
      affectedPatients += 1;
      fixedFieldCount += Object.keys(updates).length;

      console.log(
        `Patient id=${row.id} (patientId=${row.patientId}): fields to repair -> ${Object.keys(
          updates
        ).join(", ")}`
      );

      if (apply) {
        await Patient.update(updates, {
          where: { id: row.id },
          hooks: false,
          individualHooks: false,
        });
      }
    }
  }

  console.log(
    `\nDone. Scanned ${totalPatients} patients. ${affectedPatients} patient(s) had double-encrypted fields (${fixedFieldCount} field(s) total).`
  );

  if (!apply && affectedPatients > 0) {
    console.log("Re-run with --apply to actually write these fixes.");
  }

  await sequelize.close();
}

run().catch((err) => {
  console.error("Repair script failed:", err);
  process.exit(1);
});
