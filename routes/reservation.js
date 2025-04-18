import express from "express";
import {
  getReservations,
  getReservation,
  getUserReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  shareReservation,
  removeSharedUser,
  requestExtension,
  approveExtension,
  initializeReminders,
} from "../controllers/reservation.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Base routes
router
  .route("/")
  .get(authorize("admin"), getReservations)
  .post(createReservation);

router.route("/me").get(getUserReservations);

router
  .route("/:id")
  .get(getReservation)
  .put(updateReservation)
  .delete(deleteReservation);

// Feature 1: Reminders
router
  .route("/initialize-reminders")
  .post(authorize("admin"), initializeReminders);

// Feature 2: Sharing
router.route("/:id/share").post(shareReservation);
router.route("/:id/share/:userId").delete(removeSharedUser);

// Feature 3: Extension
router.route("/:id/extend").post(requestExtension);
router
  .route("/:id/approve-extension")
  .put(authorize("admin"), approveExtension);

export default router;
