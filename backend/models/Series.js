
const mongoose = require("mongoose");

const seriesSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    releaseYear: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear(),
    },
    status: {
      type: String,
      enum: ["To Watch", "Watching", "Watched"],
      default: "To Watch",
    },
  },
  { timestamps: true }
);

seriesSchema.index(
  { title: 1, releaseYear: 1 },
  { unique: true }
);

module.exports = mongoose.model("Series", seriesSchema);
