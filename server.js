import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import os from "os";
import auth from "./routes/auth.js";

dotenv.config({ path: "./config/config.env" });

async function startServer() {
	try {
		await connectDB();
		console.log("Database connected successfully.");

		const app = express();
		app.use(express.json());
		app.use(cookieParser());

		const router = express.Router();
		router.get("/", (req, res) => {
			res.send("API is running...");
		});
		router.use("/auth", auth);
		app.use("/api/v1", router);

		const port = process.env.PORT || 5000;

		const server = app.listen(port, () => {
			console.log("Express server listening on:");
			console.log(`  Local:   http://localhost:${port}`);
			console.log(`  NodeJS Version: ${process.version}`);
			console.log(`  OS: ${os.type()} ${os.release()}`);
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
