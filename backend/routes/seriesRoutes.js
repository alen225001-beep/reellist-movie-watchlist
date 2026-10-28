
const express = require("express");
const Series = require("../models/Series");

const router = express.Router();

// Get all series
router.get("/", async (req, res) => {
  try {
    const series = await Series.find().sort({ title: 1 });
    res.json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve series.",
    });
  }
});

// Add a series
router.post("/", async (req, res) => {
  try {
    const { title, releaseYear, status } = req.body;

    if (!title || !Number.isInteger(Number(releaseYear))) {
      return res.status(400).json({
        success: false,
        message: "Title and a valid release year are required.",
      });
    }

    const series = await Series.create({
      title,
      releaseYear: Number(releaseYear),
      ...(status && { status }),
    });

    res.status(201).json({
      success: true,
      message: "Series added successfully.",
      data: series,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This series is already in your watchlist.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to add series.",
    });
  }
});

// Update a series' watched status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["To Watch", "Watching", "Watched"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid series status.",
      });
    }

    const series = await Series.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!series) {
      return res.status(404).json({
        success: false,
        message: "Series not found.",
      });
    }

    res.json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update series status.",
    });
  }
});

// Delete a series
router.delete("/:id", async (req, res) => {
  try {
    const series = await Series.findByIdAndDelete(req.params.id);

    if (!series) {
      return res.status(404).json({
        success: false,
        message: "Series not found.",
      });
    }

    res.json({
      success: true,
      message: "Series deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete series.",
    });
  }
});

module.exports = router;
