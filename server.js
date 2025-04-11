import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import os from "os";

dotenv.config({ path: "./config/config.env" });

connectDB();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
	res.send("API is running...");
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
	console.log("Express server listening on:");
	console.log(`  Local:   http://localhost:${port}`);
	console.log(`  NodeJS Version: ${process.version}`);
	console.log(`  OS: ${os.type()} ${os.release()}`);
});

process.on("unhandledRejection", (err) => {
	console.log(`Error: ${err.message}`);
	server.close(() => process.exit(1));
});
