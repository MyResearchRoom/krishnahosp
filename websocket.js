const WebSocket = require("ws");
const url = require("url");
const jwt = require("jsonwebtoken");

const doctors = new Map();
let receptionists = new Map();

exports.updateCheckInOutNotification = (payload, docId) => {
  const doctorId = typeof docId === "number" ? `${docId}` : docId;
  const doctorWs = doctors.get(doctorId);
  if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
    doctorWs.send(JSON.stringify(payload));
  }
};

exports.update = (payload, docId) => {
  const doctorId = typeof docId === "number" ? `${docId}` : docId;
  const receptionistsArr = receptionists.get(doctorId) || [];
  for (const receptionist of receptionistsArr) {
    if (receptionist.ws.readyState === WebSocket.OPEN) {
      receptionist.ws.send(JSON.stringify(payload));
    }
  }
  const doctorWs = doctors.get(doctorId);
  if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
    doctorWs.send(JSON.stringify(payload));
  }
};

exports.setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", async (ws, req) => {
    const { query } = url.parse(req.url, true);
    const { token } = query;
    let { doctorId } = query;

    if (!token) {
      ws.close(4001, "Token missing");
      return;
    }

    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
      user.id = typeof user.id === "number" ? `${user.id}` : user.id;
    } catch {
      ws.close(4002, "Invalid token");
      return;
    }

    if (!doctorId) doctorId = user.hospitalId;
    if(typeof doctorId === 'number') doctorId=`${doctorId}`
    if (user.role === "receptionist") {
      for (const [docId, receptionistsArr] of receptionists.entries()) {
        const index = receptionistsArr.findIndex((r) => r.id === user.id);
        if (index !== -1) {
          receptionistsArr.splice(index, 1);
          receptionists.set(docId, receptionistsArr);
        }
      }

      if (!receptionists.has(doctorId)) {
        receptionists.set(doctorId, []);
      }

      const receptionistsArr = receptionists.get(doctorId) || [];
      const existingReceptionistIndex = receptionistsArr.findIndex(
        (r) => r.id === user.id
      );

      if (existingReceptionistIndex !== -1)
        receptionistsArr[existingReceptionistIndex].ws = ws;
      else receptionistsArr.push({ id: user.id, ws });

      receptionists.set(doctorId, receptionistsArr);
    } else {
      doctors.set(user.id, ws);
    }

    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.send(
      JSON.stringify({ type: "info", message: "Connected to WebSocket server" })
    );

    ws.on("close", () => {
      if (user.role === "receptionist") {
        for (const [doctorId, receptionistsArr] of receptionists.entries()) {
          const index = receptionistsArr.findIndex((r) => r.id === user.id);
          if (index !== -1) {
            receptionistsArr.splice(index, 1);
            receptionists.set(doctorId, receptionistsArr);
            break;
          }
        }
      }

      if (user.role === "doctor") doctors.delete(user.id);
    });
  });

  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  console.log("✅ WebSocket server initialized");
};
