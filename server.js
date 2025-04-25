import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import os from "os";
import authRoutes from "./routes/auth.js";
import coworkingSpaceRoutes from "./routes/coWorkingSpace.js";
import roomRoutes from "./routes/room.js";
import reservationRoutes from "./routes/reservation.js";
import { startAgenda } from "./utils/agenda.js";

dotenv.config({ path: "./config/config.env" });

async function startServer() {
  try {
    await connectDB();
    console.log("Database connected successfully.");

    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    app.get("/", (req, res) => {
      res.send("API is running...");
    });
    const router = express.Router();
    app.use("/api/v1", router);

    router.use("/auth", authRoutes);
    router.use("/coworking-spaces", coworkingSpaceRoutes);
    router.use("/rooms", roomRoutes);
    router.use("/reservations", reservationRoutes);

    const port = process.env.PORT || 5000;

    const server = app.listen(port, () => {
      console.log("Express server listening on:");
      console.log(`  Local:   http://localhost:${port}`);
      console.log(`  NodeJS Version: ${process.version}`);
      console.log(`  OS: ${os.type()} ${os.release()}`);

      // Start Agenda after server is running
      startAgenda();
    });

    process.on("unhandledRejection", (err) => {
      console.error(`Unhandled Rejection Error: ${err.message}`);
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1); // Exit with error code
  }
}

startServer();
