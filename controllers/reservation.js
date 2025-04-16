import Reservation from '../models/Reservation.js';
import asyncHandler from '../middleware/async.js';
import CoWorkingSpace from '../models/CoWorkingSpace.js';
import Room from '../models/Room.js';

// @desc    Get all reservations (Admin only)
// @route   GET /api/v1/reservations
// @access  Private (Admin)
export const getReservations = asyncHandler(async (req, res, next) => {
  const reservations = await Reservation.find().populate('user coworkingSpace room');
  res.status(200).json({ success: true, count: reservations.length, data: reservations });
});

// @desc    Get a single reservation
// @route   GET /api/v1/reservations/:id
// @access  Private (User/Admin - can check ownership)
export const getReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id).populate('user coworkingSpace room');
  if (!reservation) {
    return res.status(404).json({ success: false, msg: `Reservation not found with id ${req.params.id}` });
  }
  // Add logic to check if the user owns the reservation or is an admin
  res.status(200).json({ success: true, data: reservation });
});

// @desc    Get logged in user's reservations
// @route   GET /api/v1/users/me/reservations
// @access  Private (User)
export const getUserReservations = asyncHandler(async (req, res, next) => {
  const reservations = await Reservation.find({ user: req.user.id }).populate('coworkingSpace room');
  res.status(200).json({ success: true, count: reservations.length, data: reservations });
});

// @desc    Create a new reservation
// @route   POST /api/v1/reservations
// @access  Private (User)
export const createReservation = asyncHandler(async (req, res, next) => {
  req.body.user = req.user.id; // Assuming you have authentication middleware that sets req.user

  // Check if the co-working space and room exist
  const coworkingSpace = await CoWorkingSpace.findById(req.body.coWorkingSpace);
  if (!coworkingSpace) {
    return res.status(404).json({ success: false, msg: `Co-working space not found with id ${req.body.coWorkingSpace}` });
  }
  const room = await Room.findById(req.body.room);
  if (!room) {
    return res.status(404).json({ success: false, msg: `Room not found with id ${req.body.room}` });
  }

  // Add more validation logic (e.g., check for room availability)

  const reservation = await Reservation.create(req.body);
  res.status(201).json({ success: true, data: reservation });
});

// @desc    Update a reservation
// @route   PUT /api/v1/reservations/:id
// @access  Private (User - ownership check, Admin)
export const updateReservation = asyncHandler(async (req, res, next) => {
  let reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({ success: false, msg: `Reservation not found with id ${req.params.id}` });
  }

  // Ensure user owns the reservation or is an admin (add your auth logic here)
  // if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
  //   return res.status(401).json({ success: false, msg: `User not authorized to update this reservation` });
  // }

  reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('user coworkingSpace room');

  res.status(200).json({ success: true, data: reservation });
});

// @desc    Delete a reservation
// @route   DELETE /api/v1/reservations/:id
// @access  Private (User - ownership check, Admin)
export const deleteReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({ success: false, msg: `Reservation not found with id ${req.params.id}` });
  }

  // Ensure user owns the reservation or is an admin (add your auth logic here)
  // if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
  //   return res.status(401).json({ success: false, msg: `User not authorized to delete this reservation` });
  // }

  await reservation.deleteOne();

  res.status(200).json({ success: true, data: {} });
});