
const mongoose = require("mongoose");

const trackingEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const parcelSchema = new mongoose.Schema(
  {
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    senderName: { type: String, required: true, trim: true },
    senderPhone: { type: String, required: true, trim: true },
    receiverName: { type: String, required: true, trim: true },
    receiverPhone: { type: String, required: true, trim: true },
    senderAddress: { type: String, required: true, trim: true },
    receiverAddress: { type: String, required: true, trim: true },
    parcelType: { type: String, default: "Package" },
    weight: { type: Number, min: 0, default: 0 },

    status: {
      type: String,
      enum: [
        "REGISTERED",
        "COLLECTED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "REGISTERED",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    trackingHistory: {
      type: [trackingEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Parcel", parcelSchema);
