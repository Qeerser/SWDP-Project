import mongoose from "mongoose";

const ReservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coWorkingSpace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoWorkingSpace",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    date: {
      type: Date,
      required: [true, "Please add a reservation date"],
    },
    startTime: {
      type: Date,
      required: [true, "Please add a start time"],
    },
    endTime: {
      type: Date,
      required: [true, "Please add an end time"],
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    extensionRequested: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Reservation", ReservationSchema);
