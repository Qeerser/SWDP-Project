import Reservation from "../models/Reservation.js";
import asyncHandler from "../middleware/async.js";
import CoWorkingSpace from "../models/CoWorkingSpace.js";
import Room from "../models/Room.js";
import User from "../models/User.js";

// @desc    Get all reservations (Admin only)
// @route   GET /api/v1/reservations
// @access  Private (Admin)
export const getReservations = asyncHandler(async (req, res, next) => {
  const reservations = await Reservation.find()
    .populate("coWorkingSpace")
    .populate("sharedWith"); // Add this to populate shared users

  res
    .status(200)
    .json({ success: true, count: reservations.length, data: reservations });
});

// @desc    Get a single reservation
// @route   GET /api/v1/reservations/:id
// @access  Private (User/Admin - can check ownership)
export const getReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate("coWorkingSpace")
    .populate("sharedWith"); // Add this to populate shared users

  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Add logic to check if the user owns the reservation or is an admin
  // Also check if the reservation is shared with the user
  const isSharedWithUser =
    reservation.sharedWith &&
    reservation.sharedWith.some((user) => user._id.toString() === req.user.id);

  if (
    reservation.user._id.toString() !== req.user.id &&
    req.user.role !== "admin" &&
    !isSharedWithUser
  ) {
    return res.status(401).json({
      success: false,
      msg: "Not authorized to access this reservation",
    });
  }

  res.status(200).json({ success: true, data: reservation });
});

// @desc    Get logged in user's reservations
// @route   GET /api/v1/users/me/reservations
// @access  Private (User)
export const getUserReservations = asyncHandler(async (req, res, next) => {
  // Get both owned reservations and shared reservations
  const ownedReservations = await Reservation.find({
    user: req.user.id,
  }).populate("coWorkingSpace");

  const sharedReservations = await Reservation.find({
    sharedWith: req.user.id,
  }).populate("coWorkingSpace");

  // Combine the results
  const reservations = [...ownedReservations, ...sharedReservations];

  res.status(200).json({
    success: true,
    count: reservations.length,
    data: reservations,
  });
});

// @desc    Create a new reservation
// @route   POST /api/v1/reservations
// @access  Private (User)
export const createReservation = asyncHandler(async (req, res, next) => {
  req.body.user = req.user.id; // Assuming you have authentication middleware that sets req.user

  // Check if the co-working space and room exist
  const coworkingSpace = await CoWorkingSpace.findById(req.body.coWorkingSpace);
  if (!coworkingSpace) {
    return res.status(404).json({
      success: false,
      msg: `Co-working space not found with id ${req.body.coWorkingSpace}`,
    });
  }

  const room = await Room.findById(req.body.room);
  if (!room) {
    return res.status(404).json({
      success: false,
      msg: `Room not found with id ${req.body.room}`,
    });
  }

  // Check if room is available for the requested time
  const existingReservation = await Reservation.findOne({
    room: req.body.room,
    $or: [
      {
        startTime: { $lte: new Date(req.body.startTime) },
        endTime: { $gt: new Date(req.body.startTime) },
      },
      {
        startTime: { $lt: new Date(req.body.endTime) },
        endTime: { $gte: new Date(req.body.endTime) },
      },
      {
        startTime: { $gte: new Date(req.body.startTime) },
        endTime: { $lte: new Date(req.body.endTime) },
      },
    ],
    status: { $ne: "cancelled" },
  });

  if (existingReservation) {
    return res.status(400).json({
      success: false,
      msg: "Room is already reserved for this time",
    });
  }

  const reservation = await Reservation.create(req.body);

  // Schedule a reminder for this reservation
  scheduleReservationReminder(reservation._id);

  res.status(201).json({ success: true, data: reservation });
});

// @desc    Update a reservation
// @route   PUT /api/v1/reservations/:id
// @access  Private (User - ownership check, Admin)
export const updateReservation = asyncHandler(async (req, res, next) => {
  let reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Ensure user owns the reservation or is an admin
  if (
    reservation.user.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return res.status(401).json({
      success: false,
      msg: `User not authorized to update this reservation`,
    });
  }

  reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate("coWorkingSpace");

  res.status(200).json({ success: true, data: reservation });
});

// @desc    Delete a reservation
// @route   DELETE /api/v1/reservations/:id
// @access  Private (User - ownership check, Admin)
export const deleteReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Ensure user owns the reservation or is an admin
  if (
    reservation.user.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return res.status(401).json({
      success: false,
      msg: `User not authorized to delete this reservation`,
    });
  }

  await reservation.deleteOne();

  res.status(200).json({ success: true, data: {} });
});

// FEATURE 1: Automatic Reservation Reminders
// @desc    Schedule a reminder for a reservation
// @param   reservationId - The ID of the reservation to schedule a reminder for
const scheduleReservationReminder = async (reservationId) => {
  try {
    const reservation = await Reservation.findById(reservationId)
      .populate("user", "email name")
      .populate("room", "name");

    if (!reservation) {
      console.error(`Reservation ${reservationId} not found for reminder`);
      return;
    }

    // Calculate time until 1 hour before reservation
    const reminderTime = new Date(reservation.startTime);
    reminderTime.setHours(reminderTime.getHours() - 1);

    const now = new Date();
    const timeUntilReminder = reminderTime.getTime() - now.getTime();

    if (timeUntilReminder <= 0) {
      // If the reminder time has already passed, send immediately
      sendReservationReminder(reservation);
    } else {
      // Schedule the reminder
      setTimeout(() => {
        sendReservationReminder(reservation);
      }, timeUntilReminder);

      console.log(
        `Reminder scheduled for reservation ${reservationId} in ${
          timeUntilReminder / 1000 / 60
        } minutes`
      );
    }
  } catch (err) {
    console.error("Error scheduling reminder:", err);
  }
};

// @desc    Send a reminder for a reservation
// @param   reservation - The reservation object to send a reminder for
const sendReservationReminder = async (reservation) => {
  try {
    // In a real application, you would send an email or notification here
    console.log(
      `REMINDER: Sending reminder to ${reservation.user.email} for reservation in ${reservation.room.name} at ${reservation.startTime}`
    );

    // Mark reminder as sent
    await Reservation.findByIdAndUpdate(reservation._id, {
      reminderSent: true,
    });

    // Also send reminders to shared users
    if (reservation.sharedWith && reservation.sharedWith.length > 0) {
      for (const userId of reservation.sharedWith) {
        const sharedUser = await User.findById(userId);
        if (sharedUser) {
          console.log(
            `REMINDER: Sending reminder to shared user ${sharedUser.email} for reservation in ${reservation.room.name} at ${reservation.startTime}`
          );
        }
      }
    }
  } catch (err) {
    console.error("Error sending reminder:", err);
  }
};

// @desc    Initialize reminders for all future reservations
// @route   POST /api/v1/reservations/initialize-reminders
// @access  Private (Admin)
export const initializeReminders = asyncHandler(async (req, res, next) => {
  // Only allow admins to initialize reminders
  if (req.user.role !== "admin") {
    return res.status(401).json({
      success: false,
      msg: "Not authorized to initialize reminders",
    });
  }

  const futureReservations = await Reservation.find({
    startTime: { $gt: new Date() },
    reminderSent: false,
  });

  for (const reservation of futureReservations) {
    scheduleReservationReminder(reservation._id);
  }

  res.status(200).json({
    success: true,
    msg: `Scheduled reminders for ${futureReservations.length} future reservations`,
  });
});

// FEATURE 2: Share Reservation with Teammates
// @desc    Share a reservation with another user
// @route   POST /api/v1/reservations/:id/share
// @access  Private (User - must own the reservation)
export const shareReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Only the owner can share the reservation
  if (reservation.user.toString() !== req.user.id) {
    return res.status(401).json({
      success: false,
      msg: "Only the owner can share this reservation",
    });
  }

  const { userIdToShareWith } = req.body;

  // Prevent duplicate shares
  if (reservation.sharedWith.includes(userIdToShareWith)) {
    return res.status(400).json({
      success: false,
      msg: "User already has access to this reservation",
    });
  }

  // Validate the user exists
  const userToShareWith = await User.findById(userIdToShareWith);
  if (!userToShareWith) {
    return res.status(404).json({
      success: false,
      msg: "User to share with not found",
    });
  }

  reservation.sharedWith.push(userIdToShareWith);
  await reservation.save();

  res.status(200).json({
    success: true,
    msg: `Reservation shared with ${userToShareWith.name}`,
    data: reservation,
  });
});

// @desc    Remove a user from the shared list
// @route   DELETE /api/v1/reservations/:id/share/:userId
// @access  Private (User - ownership check, Admin)
export const removeSharedUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  let reservation = await Reservation.findById(req.params.id);
  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Make sure user is the reservation owner
  if (
    reservation.user.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return res.status(401).json({
      success: false,
      msg: "Not authorized to modify this reservation",
    });
  }

  // Remove user from sharedWith array
  reservation = await Reservation.findByIdAndUpdate(
    req.params.id,
    { $pull: { sharedWith: userId } },
    { new: true, runValidators: true }
  )
    .populate("coWorkingSpace")
    .populate("sharedWith");

  res.status(200).json({
    success: true,
    data: reservation,
  });
});

// FEATURE 3: Extend Reservation Duration
// @desc    Request an extension for a reservation
// @route   POST /api/v1/reservations/:id/extend
// @access  Private (User - ownership check, Admin)
export const requestExtension = asyncHandler(async (req, res, next) => {
  const { newEndTime } = req.body;

  if (!newEndTime) {
    return res.status(400).json({
      success: false,
      msg: "Please provide a new end time",
    });
  }

  let reservation = await Reservation.findById(req.params.id);
  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Make sure user is the reservation owner
  if (
    reservation.user.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return res.status(401).json({
      success: false,
      msg: "Not authorized to modify this reservation",
    });
  }

  // Check if the new end time is after the current end time
  if (new Date(newEndTime) <= new Date(reservation.endTime)) {
    return res.status(400).json({
      success: false,
      msg: "New end time must be after the current end time",
    });
  }

  // Check if the room is available for the extended time
  const conflictingReservation = await Reservation.findOne({
    room: reservation.room,
    startTime: { $lt: new Date(newEndTime) },
    endTime: { $gt: reservation.endTime },
    _id: { $ne: reservation._id },
    status: { $ne: "cancelled" },
  });

  if (conflictingReservation) {
    return res.status(400).json({
      success: false,
      msg: "Room is already reserved for the extended time",
    });
  }

  // If admin, approve immediately, otherwise mark as requested
  if (req.user.role === "admin") {
    reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        endTime: newEndTime,
        extensionRequested: true,
        extensionApproved: true,
      },
      { new: true, runValidators: true }
    ).populate("coWorkingSpace");
  } else {
    reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        extensionRequested: true,
        requestedEndTime: newEndTime,
      },
      { new: true, runValidators: true }
    ).populate("coWorkingSpace");
  }

  res.status(200).json({
    success: true,
    data: reservation,
  });
});

// @desc    Approve an extension request (admin only)
// @route   PUT /api/v1/reservations/:id/approve-extension
// @access  Private (Admin)
export const approveExtension = asyncHandler(async (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== "admin") {
    return res.status(401).json({
      success: false,
      msg: "Not authorized to approve extension requests",
    });
  }

  let reservation = await Reservation.findById(req.params.id);
  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  if (!reservation.extensionRequested) {
    return res.status(400).json({
      success: false,
      msg: "No extension has been requested for this reservation",
    });
  }

  // Update the reservation with the new end time and mark as approved
  reservation = await Reservation.findByIdAndUpdate(
    req.params.id,
    {
      endTime: reservation.requestedEndTime,
      extensionApproved: true,
      $unset: { requestedEndTime: "" },
    },
    { new: true, runValidators: true }
  ).populate("coWorkingSpace");

  res.status(200).json({
    success: true,
    data: reservation,
  });
});
