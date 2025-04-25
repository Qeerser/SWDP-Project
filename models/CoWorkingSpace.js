import mongoose from "mongoose";

const CoWorkingSpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a co-working space name"],
    },
    address: {
      type: String,
      required: [true, "Please add an address"],
    },
    telephoneNumber: {
      type: String,
    },
    openTime: {
      type: String,
      required: [true, "Please add the opening time"],
    },
    closeTime: {
      type: String,
      required: [true, "Please add the closing time"],
    },
    rooms: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
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

export default mongoose.model("CoWorkingSpace", CoWorkingSpaceSchema);
