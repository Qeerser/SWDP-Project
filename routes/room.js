import express from 'express';
import {
  getCoWorkingSpaceRooms,
  getRoom,
  createCoWorkingSpaceRoom,
  updateRoom,
  deleteRoom,
} from '../controllers/room.js';
import { authorize, protect } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true }); 

router.use(protect); // Protect all routes in this router

router.route('/').get(getCoWorkingSpaceRooms).post(authorize('admin'),createCoWorkingSpaceRoom);
router.route('/:id').get(getRoom).put(authorize('admin'),updateRoom).delete(authorize('admin'),deleteRoom);

export default router;