import express from "express";
import {
	getCoWorkingSpaces,
	getCoWorkingSpace,
	createCoWorkingSpace,
	updateCoWorkingSpace,
	deleteCoWorkingSpace,
} from "../controllers/coWorkingSpace.js";
import roomRouter from "./room.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use("/:coworkingSpaceId/rooms", roomRouter);
router.route("/").get(getCoWorkingSpaces).post(authorize("admin"), createCoWorkingSpace);
router
	.route("/:id")
	.get(getCoWorkingSpace)
	.put(authorize("admin"), updateCoWorkingSpace)
	.delete(authorize("admin"), deleteCoWorkingSpace);

export default router;
