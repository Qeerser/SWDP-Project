import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a room name'],
    },
    capacity: {
      type: Number,
    },
    amenities: {
      type: [String],
    },
    coWorkingSpace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoWorkingSpace',
      required: true,
    },
    reservations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reservation',
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
  },
  { timestamps: true }
);

export default mongoose.model('Room', RoomSchema);