import Reservation from "../models/Reservation.js";
import asyncHandler from "../middleware/async.js";
import CoWorkingSpace from "../models/CoWorkingSpace.js";
import Room from "../models/Room.js";
import User from "../models/User.js";
import { agenda } from "../utils/agenda.js";
import { sendEmail } from "../utils/emailConfig.js";

// @desc    Get all reservations (Admin only)
// @route   GET /api/v1/reservations
// @access  Private (Admin)
export const getReservations = asyncHandler(async (req, res, next) => {
  const reservations = await Reservation.find()
    .populate("user coWorkingSpace room")
    .populate("sharedWith");

  res
    .status(200)
    .json({ success: true, count: reservations.length, data: reservations });
});

// @desc    Get a single reservation
// @route   GET /api/v1/reservations/:id
// @access  Private (User/Admin - can check ownership)
export const getReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate("user coWorkingSpace room")
    .populate("sharedWith");

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
  }).populate("coWorkingSpace room");

  const sharedReservations = await Reservation.find({
    sharedWith: req.user.id,
  }).populate("coWorkingSpace room");

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

  // Schedule a reminder for this reservation using Agenda
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

  // If the start time is being updated, reschedule the reminder
  const startTimeChanged =
    req.body.startTime &&
    new Date(req.body.startTime).getTime() !==
      new Date(reservation.startTime).getTime();

  reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate("coWorkingSpace room");

  // If start time changed, cancel old reminder and schedule new one
  if (startTimeChanged) {
    // Cancel existing reminder job
    await agenda.cancel({
      name: "send reservation reminder",
      "data.reservationId": reservation._id.toString(),
    });

    // Schedule new reminder
    scheduleReservationReminder(reservation._id);
  }

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

  // Cancel any scheduled reminder
  await agenda.cancel({
    name: "send reservation reminder",
    "data.reservationId": reservation._id.toString(),
  });

  await reservation.deleteOne();

  res.status(200).json({ success: true, data: {} });
});

// FEATURE 1: Automatic Reservation Reminders with Agenda and Nodemailer
// @desc    Schedule a reminder for a reservation using Agenda
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

    // Calculate time for 1 hour before reservation
    const reminderTime = new Date(reservation.startTime);
    reminderTime.setHours(reminderTime.getHours() - 1);

    // Schedule the reminder job with Agenda
    await agenda.schedule(reminderTime, "send reservation reminder", {
      reservationId: reservation._id.toString(),
    });

    console.log(
      `Reminder scheduled for reservation ${reservationId} at ${reminderTime}`
    );
  } catch (err) {
    console.error("Error scheduling reminder:", err);
  }
};

// @desc    Send a reminder email for a reservation
// @param   reservationId - The ID of the reservation to send a reminder for
export const sendReservationReminderEmail = async (reservationId) => {
  try {
    const reservation = await Reservation.findById(reservationId)
      .populate("user", "email name")
      .populate("room", "name capacity")
      .populate("coWorkingSpace", "name address")
      .populate("sharedWith", "email name");

    if (!reservation) {
      console.error(
        `Reservation ${reservationId} not found for sending reminder`
      );
      return;
    }

    // Format dates for display
    const startTime = new Date(reservation.startTime).toLocaleString();
    const endTime = new Date(reservation.endTime).toLocaleString();

    // Send email to the reservation owner
    await sendEmail({
      email: reservation.user.email,
      subject: "Reminder: Your Upcoming Reservation",
      html: `
        <h1>Reservation Reminder</h1>
        <p>Hello ${reservation.user.name},</p>
        <p>This is a reminder about your upcoming reservation:</p>
        <ul>
          <li><strong>Location:</strong> ${reservation.coWorkingSpace.name}</li>
          <li><strong>Room:</strong> ${reservation.room.name}</li>
          <li><strong>Start Time:</strong> ${startTime}</li>
          <li><strong>End Time:</strong> ${endTime}</li>
        </ul>
        <p>Please arrive on time. If you need to cancel or modify your reservation, please do so at least 2 hours in advance.</p>
        <p>Thank you for using our service!</p>
      `,
    });

    // Also send reminders to shared users
    if (reservation.sharedWith && reservation.sharedWith.length > 0) {
      for (const sharedUser of reservation.sharedWith) {
        await sendEmail({
          email: sharedUser.email,
          subject: "Reminder: Shared Reservation",
          html: `
            <h1>Shared Reservation Reminder</h1>
            <p>Hello ${sharedUser.name},</p>
            <p>${reservation.user.name} has shared a reservation with you:</p>
            <ul>
              <li><strong>Location:</strong> ${reservation.coWorkingSpace.name}</li>
              <li><strong>Room:</strong> ${reservation.room.name}</li>
              <li><strong>Start Time:</strong> ${startTime}</li>
              <li><strong>End Time:</strong> ${endTime}</li>
            </ul>
            <p>Please arrive on time.</p>
            <p>Thank you for using our service!</p>
          `,
        });
      }
    }

    // Mark reminder as sent
    await Reservation.findByIdAndUpdate(reservationId, {
      reminderSent: true,
    });

    console.log(`Reminder emails sent for reservation ${reservationId}`);
  } catch (err) {
    console.error("Error sending reminder emails:", err);
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

  // Cancel any existing reminder jobs to avoid duplicates
  await agenda.cancel({ name: "send reservation reminder" });

  const futureReservations = await Reservation.find({
    startTime: { $gt: new Date() },
    reminderSent: false,
  });

  for (const reservation of futureReservations) {
    await scheduleReservationReminder(reservation._id);
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

  // Send notification email to the user being shared with
  const startTime = new Date(reservation.startTime).toLocaleString();
  const endTime = new Date(reservation.endTime).toLocaleString();

  await sendEmail({
    email: userToShareWith.email,
    subject: "Reservation Shared With You",
    html: `
      <h1>Reservation Shared</h1>
      <p>Hello ${userToShareWith.name},</p>
      <p>${req.user.name} has shared a reservation with you:</p>
      <ul>
        <li><strong>Start Time:</strong> ${startTime}</li>
        <li><strong>End Time:</strong> ${endTime}</li>
      </ul>
      <p>You can view the full details in your account.</p>
      <p>Thank you for using our service!</p>
    `,
  });

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

  // Get user details before removing
  const userToRemove = await User.findById(userId);

  // Remove user from sharedWith array
  reservation = await Reservation.findByIdAndUpdate(
    req.params.id,
    { $pull: { sharedWith: userId } },
    { new: true, runValidators: true }
  )
    .populate("coWorkingSpace room")
    .populate("sharedWith");

  // Notify the user that they've been removed
  if (userToRemove) {
    await sendEmail({
      email: userToRemove.email,
      subject: "Reservation Access Removed",
      html: `
        <h1>Reservation Access Update</h1>
        <p>Hello ${userToRemove.name},</p>
        <p>Your access to a shared reservation has been removed.</p>
        <p>If you believe this is an error, please contact the reservation owner.</p>
      `,
    });
  }

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

  let reservation = await Reservation.findById(req.params.id)
    .populate("user", "email name")
    .populate("room", "name");

  if (!reservation) {
    return res.status(404).json({
      success: false,
      msg: `Reservation not found with id ${req.params.id}`,
    });
  }

  // Make sure user is the reservation owner
  if (
    reservation.user._id.toString() !== req.user.id &&
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
    room: reservation.room._id,
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
    ).populate("coWorkingSpace room");

    // Notify the user that their extension was approved
    await sendEmail({
      email: reservation.user.email,
      subject: "Reservation Extension Approved",
      html: `
        <h1>Extension Approved</h1>
        <p>Hello ${reservation.user.name},</p>
        <p>Your request to extend your reservation in ${
          reservation.room.name
        } has been approved.</p>
        <p>The reservation now ends at ${new Date(
          newEndTime
        ).toLocaleString()}.</p>
      `,
    });
  } else {
    reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        extensionRequested: true,
        requestedEndTime: newEndTime,
      },
      { new: true, runValidators: true }
    ).populate("coWorkingSpace room");

    // Notify admins about the extension request
    const admins = await User.find({ role: "admin" });

    for (const admin of admins) {
      await sendEmail({
        email: admin.email,
        subject: "New Reservation Extension Request",
        html: `
          <h1>Extension Request</h1>
          <p>Hello ${admin.name},</p>
          <p>User ${
            reservation.user.name
          } has requested to extend their reservation in ${
          reservation.room.name
        }.</p>
          <p>Current end time: ${new Date(
            reservation.endTime
          ).toLocaleString()}</p>
          <p>Requested end time: ${new Date(newEndTime).toLocaleString()}</p>
          <p>Please review this request in the admin dashboard.</p>
        `,
      });
    }
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

  let reservation = await Reservation.findById(req.params.id)
    .populate("user", "email name")
    .populate("room", "name");

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
  ).populate("coWorkingSpace room");

  // Notify the user that their extension was approved
  await sendEmail({
    email: reservation.user.email,
    subject: "Reservation Extension Approved",
    html: `
      <h1>Extension Approved</h1>
      <p>Hello ${reservation.user.name},</p>
      <p>Your request to extend your reservation in ${
        reservation.room.name
      } has been approved.</p>
      <p>The reservation now ends at ${new Date(
        reservation.endTime
      ).toLocaleString()}.</p>
    `,
  });

  res.status(200).json({
    success: true,
    data: reservation,
  });
});
