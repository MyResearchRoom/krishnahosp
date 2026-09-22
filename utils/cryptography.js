const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";

exports.encrypt = (data) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let encrypted = cipher.update(data, "utf-8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

exports.decrypt = (encryptedData) => {
  if (!encryptedData || typeof encryptedData !== "string") {
    return encryptedData || null;
  }

  // If data does not match the 32-hex-char IV : hex cipher pattern, it is not encrypted
  if (!/^[0-9a-f]{32}:[0-9a-f]+$/i.test(encryptedData)) {
    return encryptedData;
  }

  try {
    const [ivHex, encryptedHex] = encryptedData.split(":");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, "hex"),
      Buffer.from(ivHex, "hex")
    );

    let decrypted = decipher.update(
      Buffer.from(encryptedHex, "hex"),
      "hex",
      "utf-8"
    );
    decrypted += decipher.final("utf-8");

    return decrypted;
  } catch (error) {
    // If decryption fails, return original data safely
    return encryptedData;
  }
};

exports.getDecryptedDocumentAsBase64 = (bufferData) => {
  if (!bufferData) return null;

  let encryptedData = bufferData.toString("utf-8");

  for (let i = 0; i < 3; i++) {
    if (!/^[0-9a-f]{32}:[0-9a-f]+$/i.test(encryptedData)) break;
    encryptedData = exports.decrypt(encryptedData);
  }

  return encryptedData;
};

