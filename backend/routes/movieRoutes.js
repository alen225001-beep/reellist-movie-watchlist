
const express = require("express");
const mongoose = require("mongoose");
const Movie = require("../models/Movie");

const router = express.Router();

function sendResponse(res, status, success, message, data = null) {
  return res.status(status).json({
    success,
    message,
    data
  });
}

// Generate the next sequence number for a release year.
async function generateMovieCode(releaseYear) {
  const prefix = `MV-${releaseYear}-`;

  // Use a counter collection so sequence numbers remain unique
  // even when multiple requests arrive at nearly the same time.
  const Counter =
    mongoose.models.MovieCounter ||
    mongoose.model(
      "MovieCounter",
      new mongoose.Schema({
        _id: String,
        sequence: { type: Number, default: 0 }
      })
    );

  const counter = await Counter.findOneAndUpdate(
    { _id: String(releaseYear) },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  return `${prefix}${String(counter.sequence).padStart(3, "0")}`;
}

// ADD MOVIE
router.post("/", async (req, res) => {
  try {
    const {
      title,
      genre,
      releaseYear,
      runtime,
      platform,
      priority
    } = req.body;

    if (
      !title?.trim() ||
      !genre ||
      releaseYear === undefined ||
      runtime === undefined ||
      !platform ||
      priority === undefined
    ) {
      return sendResponse(
        res, 400, false, "Please provide all required movie fields."
      );
    }

    const year = Number(releaseYear);
    const minutes = Number(runtime);
    const moviePriority = Number(priority);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1950 || year > currentYear) {
      return sendResponse(
        res, 400, false,
        `Release year must be between 1950 and ${currentYear}.`
      );
    }

    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 300) {
      return sendResponse(
        res, 400, false, "Runtime must be between 30 and 300 minutes."
      );
    }

    if (
      !Number.isInteger(moviePriority) ||
      moviePriority < 1 ||
      moviePriority > 5
    ) {
      return sendResponse(
        res, 400, false, "Priority must be between 1 and 5."
      );
    }

    const duplicate = await Movie.findOne({
      title: title.trim(),
      releaseYear: year
    }).collation({ locale: "en", strength: 2 });

    if (duplicate) {
      return sendResponse(
        res, 409, false,
        "A movie with this title and release year already exists."
      );
    }

    const movieCode = await generateMovieCode(year);

    const movie = await Movie.create({
      movieCode,
      title: title.trim(),
      genre,
      releaseYear: year,
      runtime: minutes,
      platform,
      priority: moviePriority,
      status: "To Watch",
      rating: null,
      watchedDate: null
    });

    return sendResponse(res, 201, true, "Movie added successfully.", movie);
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return sendResponse(
        res, 409, false,
        "A movie with this title and release year already exists."
      );
    }

    if (error.name === "ValidationError") {
      return sendResponse(res, 400, false, error.message);
    }

    return sendResponse(res, 500, false, "Failed to add movie.");
  }
});

/* VIEW MOVIES: search, filters and pagination */
router.get("/", async (req, res) => {
  try {
    const { status, genre, search = "", page = 1 } = req.query;

    const currentPage = Number(page);

    if (!Number.isInteger(currentPage) || currentPage < 1) {
      return sendResponse(res, 400, false, "Page must be a positive integer.");
    }

    if (
      status &&
      !["To Watch", "Watching", "Watched"].includes(status)
    ) {
      return sendResponse(res, 400, false, "Invalid status filter.");
    }

    const allowedGenres = [
      "Action", "Comedy", "Drama", "Horror",
      "Sci-Fi", "Romance", "Thriller"
    ];

    if (genre && !allowedGenres.includes(genre)) {
      return sendResponse(res, 400, false, "Invalid genre filter.");
    }

    const filter = {};

    if (status) filter.status = status;
    if (genre) filter.genre = genre;

    if (search.trim()) {
      filter.title = {
        $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i"
      };
    }

    const limit = 6;
    const skip = (currentPage - 1) * limit;

    const totalMovies = await Movie.countDocuments(filter);

    const movies = await Movie.aggregate([
      { $match: filter },
      {
        $addFields: {
          statusOrder: {
            $cond: [{ $eq: ["$status", "To Watch"] }, 0, 1]
          }
        }
      },
      {
        $sort: {
          statusOrder: 1,
          priority: -1,
          createdAt: -1
        }
      },
      { $skip: skip },
      { $limit: limit },
      { $project: { statusOrder: 0 } }
    ]);

    return sendResponse(res, 200, true, "Movies retrieved successfully.", {
      movies,
      currentPage,
      totalMovies,
      totalPages: Math.ceil(totalMovies / limit)
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, "Failed to retrieve movies.");
  }
});


/* WATCH NEXT */
router.get("/watch-next", async (req, res) => {
  try {
    const movie = await Movie.findOne({ status: "To Watch" })
      .sort({ priority: -1, runtime: 1 });

    if (!movie) {
      return sendResponse(
        res, 404, false, "No movies are currently waiting to be watched."
      );
    }

    return sendResponse(res, 200, true, "Here is your next movie.", movie);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, "Failed to find the next movie.");
  }
});


/* STATISTICS DASHBOARD */
router.get("/stats", async (req, res) => {
  try {
    const statusCounts = await Movie.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const counts = {
      "To Watch": 0,
      "Watching": 0,
      "Watched": 0
    };

    statusCounts.forEach(item => {
      counts[item._id] = item.count;
    });

    const watchedStats = await Movie.aggregate([
      { $match: { status: "Watched" } },
      {
        $group: {
          _id: null,
          totalRuntime: { $sum: "$runtime" },
          averageRating: { $avg: "$rating" }
        }
      }
    ]);

    const genreStats = await Movie.aggregate([
      { $match: { status: "Watched" } },
      {
        $group: {
          _id: "$genre",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 1 }
    ]);

    const watched = watchedStats[0] || {
      totalRuntime: 0,
      averageRating: null
    };

    return sendResponse(res, 200, true, "Statistics retrieved successfully.", {
      statusCounts: counts,
      totalHoursWatched: Number((watched.totalRuntime / 60).toFixed(2)),
      averageRating: watched.averageRating == null
        ? null
        : Number(watched.averageRating.toFixed(1)),
      topWatchedGenre: genreStats.length
        ? {
            genre: genreStats[0]._id,
            count: genreStats[0].count
          }
        : null
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, false, "Failed to calculate statistics.");
  }
});

/* CHANGE STATUS AND MANAGE RATINGS */
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, rating } = req.body;

    if (!["To Watch", "Watching", "Watched"].includes(status)) {
      return sendResponse(res, 400, false, "Invalid movie status.");
    }

    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return sendResponse(res, 404, false, "Movie not found.");
    }

    if (movie.status === "Watched") {
      return sendResponse(
        res, 400, false, "Watched movies cannot change status."
      );
    }

    const allowedTransitions = {
      "To Watch": ["Watching", "Watched"],
      "Watching": ["Watched", "To Watch"]
    };

    if (!allowedTransitions[movie.status].includes(status)) {
      return sendResponse(res, 400, false, "Invalid status transition.");
    }

    if (status === "Watched") {
      if (
        rating === undefined ||
        !Number.isInteger(Number(rating)) ||
        Number(rating) < 1 ||
        Number(rating) > 10
      ) {
        return sendResponse(
          res, 400, false, "A rating from 1 to 10 is required."
        );
      }

      movie.rating = Number(rating);
      movie.watchedDate = new Date();
    } else {
      if (rating !== undefined) {
        return sendResponse(
          res, 400, false, "Rating is only allowed for Watched movies."
        );
      }

      movie.rating = null;
      movie.watchedDate = null;
    }

    movie.status = status;
    await movie.save();

    return sendResponse(res, 200, true, "Movie status updated.", movie);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 400, false, "Invalid movie ID or request.");
  }
});


/* EDIT MOVIE DETAILS */
router.patch("/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return sendResponse(res, 404, false, "Movie not found.");
    }

    const allowedFields = [
      "title", "genre", "runtime", "platform", "priority"
    ];

    const updates = Object.keys(req.body);

    if (
      updates.length === 0 ||
      updates.some(field => !allowedFields.includes(field))
    ) {
      return sendResponse(
        res, 400, false,
        "Only title, genre, runtime, platform and priority can be edited."
      );
    }

    const allowedGenres = [
      "Action", "Comedy", "Drama", "Horror",
      "Sci-Fi", "Romance", "Thriller"
    ];

    const allowedPlatforms = [
      "Netflix", "Prime Video", "Hotstar", "Theatre", "Other"
    ];

    if (req.body.title !== undefined) {
      if (
        typeof req.body.title !== "string" ||
        !req.body.title.trim()
      ) {
        return sendResponse(res, 400, false, "Title is required.");
      }

      const duplicate = await Movie.findOne({
        _id: { $ne: movie._id },
        title: req.body.title.trim(),
        releaseYear: movie.releaseYear
      }).collation({ locale: "en", strength: 2 });

      if (duplicate) {
        return sendResponse(
          res, 409, false,
          "A movie with this title and release year already exists."
        );
      }

      movie.title = req.body.title.trim();
    }

    if (
      req.body.genre !== undefined &&
      !allowedGenres.includes(req.body.genre)
    ) {
      return sendResponse(res, 400, false, "Invalid genre.");
    }

    if (
      req.body.platform !== undefined &&
      !allowedPlatforms.includes(req.body.platform)
    ) {
      return sendResponse(res, 400, false, "Invalid platform.");
    }

    if (req.body.runtime !== undefined) {
      const runtime = Number(req.body.runtime);

      if (!Number.isInteger(runtime) || runtime < 30 || runtime > 300) {
        return sendResponse(
          res, 400, false, "Runtime must be between 30 and 300 minutes."
        );
      }

      movie.runtime = runtime;
    }

    if (req.body.priority !== undefined) {
      const priority = Number(req.body.priority);

      if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
        return sendResponse(
          res, 400, false, "Priority must be between 1 and 5."
        );
      }

      movie.priority = priority;
    }

    if (req.body.genre !== undefined) movie.genre = req.body.genre;
    if (req.body.platform !== undefined) movie.platform = req.body.platform;

    await movie.save();

    return sendResponse(res, 200, true, "Movie updated successfully.", movie);
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return sendResponse(
        res, 409, false,
        "A movie with this title and release year already exists."
      );
    }

    return sendResponse(res, 400, false, "Failed to update movie.");
  }
});


/* EDIT RATING FOR A WATCHED MOVIE */
router.patch("/:id/rating", async (req, res) => {
  try {
    const rating = req.body.rating;

    if (
      rating === undefined ||
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 10
    ) {
      return sendResponse(res, 400, false, "Rating must be from 1 to 10.");
    }

    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return sendResponse(res, 404, false, "Movie not found.");
    }

    if (movie.status !== "Watched") {
      return sendResponse(
        res, 400, false, "Only Watched movies can have a rating."
      );
    }

    movie.rating = Number(rating);
    await movie.save();

    return sendResponse(res, 200, true, "Rating updated.", movie);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 400, false, "Failed to update rating.");
  }
});


/* DELETE MOVIE */
router.delete("/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return sendResponse(res, 404, false, "Movie not found.");
    }

    if (movie.status === "Watching") {
      return sendResponse(
        res, 400, false, "A movie currently being watched cannot be deleted."
      );
    }

    await movie.deleteOne();

    return sendResponse(res, 200, true, "Movie deleted successfully.", movie);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 400, false, "Failed to delete movie.");
  }
});


module.exports = router;
