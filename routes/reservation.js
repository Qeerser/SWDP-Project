import express from "express";
import {
	getReservations,
	getReservation,
	getUserReservations,
	createReservation,
	updateReservation,
	deleteReservation,
} from "../controllers/reservation.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(authorize("admin"), getReservations).post(protect, createReservation);
router.route("/me").get(getUserReservations);
router.route("/:id").get(getReservation).put(updateReservation).delete(deleteReservation);

export default router;
