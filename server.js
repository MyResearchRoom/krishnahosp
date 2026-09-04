const express = require("express");
require("dotenv").config();
const bodyParser = require("body-parser");
const { setupWebSocket } = require("./websocket.js");
const { startAppointmentReminderJob } = require("./jobs/appointmentReminderJob");
const http = require("http");

const app = express();

const cors = require("cors");
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

app.set("trust proxy", true);

app.use((req, res, next) => {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip;

  if (ip === "::1") ip = "127.0.0.1";
  if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

  req.clientIp = ip;
  next();
});

app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toUTCString()} ${req.url}`);
  next();
});

const routes = require("./routes");
app.use(routes);

require("./jobs")();
startAppointmentReminderJob(); // <-- NEW: starts the 2-hours-before reminder scheduler

const server = http.createServer(app);

setupWebSocket(server);

const errorHandler = require("./middlewares/errorHandler.js");
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});