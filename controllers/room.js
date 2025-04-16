import Room from '../models/Room.js';
import asyncHandler from '../middleware/async.js';
import CoWorkingSpace from '../models/CoWorkingSpace.js';

// @desc    Get all rooms for a specific co-working space
// @route   GET /api/v1/coworking-spaces/:coworkingSpaceId/rooms
// @access  Public
export const getCoWorkingSpaceRooms = asyncHandler(async (req, res, next) => {
  const rooms = await Room.find({ coWorkingSpace: req.params.coworkingSpaceId });
  res.status(200).json({ success: true, count: rooms.length, data: rooms });
});

// @desc    Get a single room
// @route   GET /api/v1/rooms/:id
// @access  Public
export const getRoom = asyncHandler(async (req, res, next) => {
  const room = await Room.findById(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, msg: `Room not found with id ${req.params.id}` });
  }
  res.status(200).json({ success: true, data: room });
});

// @desc    Create a new room for a co-working space
// @route   POST /api/v1/coworking-spaces/:coworkingSpaceId/rooms
// @access  Private (Admin)
export const createCoWorkingSpaceRoom = asyncHandler(async (req, res, next) => {
  req.body.coWorkingSpace = req.params.coworkingSpaceId;
  const coworkingSpace = await CoWorkingSpace.findById(req.params.coworkingSpaceId);

  if (!coworkingSpace) {
    return res.status(404).json({ success: false, msg: `Co-working space not found with id ${req.params.coworkingSpaceId}` });
  }

  const room = await Room.create(req.body);

  // Add the room to the co-working space's rooms array
  coworkingSpace.rooms.push(room._id);
  await coworkingSpace.save();

  res.status(201).json({ success: true, data: room });
});

// @desc    Update a room
// @route   PUT /api/v1/rooms/:id
// @access  Private (Admin)
export const updateRoom = asyncHandler(async (req, res, next) => {
  const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!room) {
    return res.status(404).json({ success: false, msg: `Room not found with id ${req.params.id}` });
  }
  res.status(200).json({ success: true, data: room });
});

// @desc    Delete a room
// @route   DELETE /api/v1/rooms/:id
// @access  Private (Admin)
export const deleteRoom = asyncHandler(async (req, res, next) => {
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, msg: `Room not found with id ${req.params.id}` });
  }

  // Optionally, remove the room reference from the CoWorkingSpace
  await CoWorkingSpace.updateOne(
    { rooms: req.params.id },
    { $pull: { rooms: req.params.id } }
  );

  res.status(200).json({ success: true, data: {} });
});