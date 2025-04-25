import CoWorkingSpace from '../models/CoWorkingSpace.js';
import asyncHandler from '../middleware/async.js';

// @desc    Get all co-working spaces
// @route   GET /api/v1/coworking-spaces
// @access  Public
export const getCoWorkingSpaces = asyncHandler(async (req, res, next) => {
  const coworkingSpaces = await CoWorkingSpace.find().populate('rooms'); // Populate rooms if needed
  res.status(200).json({ success: true, count: coworkingSpaces.length, data: coworkingSpaces });
});

// @desc    Get a single co-working space
// @route   GET /api/v1/coworking-spaces/:id
// @access  Public
export const getCoWorkingSpace = asyncHandler(async (req, res, next) => {
  const coworkingSpace = await CoWorkingSpace.findById(req.params.id).populate('rooms'); // Populate rooms if needed
  if (!coworkingSpace) {
    return res.status(404).json({ success: false, msg: `Co-working space not found with id ${req.params.id}` });
  }
  res.status(200).json({ success: true, data: coworkingSpace });
});

// @desc    Create a new co-working space
// @route   POST /api/v1/coworking-spaces
// @access  Private (Admin)
export const createCoWorkingSpace = asyncHandler(async (req, res, next) => {
  const coworkingSpace = await CoWorkingSpace.create(req.body);
  res.status(201).json({ success: true, data: coworkingSpace });
});

// @desc    Update a co-working space
// @route   PUT /api/v1/coworking-spaces/:id
// @access  Private (Admin)
export const updateCoWorkingSpace = asyncHandler(async (req, res, next) => {
  const coworkingSpace = await CoWorkingSpace.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!coworkingSpace) {
    return res.status(404).json({ success: false, msg: `Co-working space not found with id ${req.params.id}` });
  }
  res.status(200).json({ success: true, data: coworkingSpace });
});

// @desc    Delete a co-working space
// @route   DELETE /api/v1/coworking-spaces/:id
// @access  Private (Admin)
export const deleteCoWorkingSpace = asyncHandler(async (req, res, next) => {
  const coworkingSpace = await CoWorkingSpace.findByIdAndDelete(req.params.id);
  if (!coworkingSpace) {
    return res.status(404).json({ success: false, msg: `Co-working space not found with id ${req.params.id}` });
  }
  // Optionally, you might want to delete associated rooms and reservations
  res.status(200).json({ success: true, data: {} });
});