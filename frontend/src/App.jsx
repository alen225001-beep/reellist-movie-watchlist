
import { useEffect, useState } from "react";
import axios from "axios";
import {
  Film, Plus, Search, Clapperboard, Clock,
  Star, Trash2, Pencil, Play, RefreshCw
} from "lucide-react";
import "./App.css";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/movies`;
const SERIES_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/series`;

const emptyForm = {
  title: "",
  genre: "Action",
  releaseYear: new Date().getFullYear(),
  runtime: 120,
  platform: "Netflix",
  priority: 3
};

const genres = [
  "Action", "Comedy", "Drama", "Horror",
  "Sci-Fi", "Romance", "Thriller"
];

const platforms = [
  "Netflix", "Prime Video", "Hotstar", "Theatre", "Other"
];

function App() {
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState("");
  const [genre, setGenre] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [ratingMovie, setRatingMovie] = useState(null);
  const [rating, setRating] = useState(8);
  const [nextMovie, setNextMovie] = useState(null);

  async function loadMovies() {
    try {
      const response = await axios.get(API, {
        params: { page, status, genre, search }
      });
      setMovies(response.data.data.movies);
      setTotalPages(response.data.data.totalPages);
    } catch {
      setError("Could not load movies. Check that the backend is running.");
    }
  }

  async function loadStats() {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data.data);
    } catch {
      setError("Could not load statistics.");
    }
  }

  async function refresh() {
    await Promise.all([loadMovies(), loadStats()]);
  }

  useEffect(() => {
    loadMovies();
  }, [page, status, genre, search]);

  useEffect(() => {
    loadStats();
  }, []);

  function startAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function startEdit(movie) {
    setEditing(movie);
    setForm({
      title: movie.title,
      genre: movie.genre,
      runtime: movie.runtime,
      platform: movie.platform,
      priority: movie.priority
    });
    setError("");
    setShowForm(true);
  }

  async function saveMovie(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const year = Number(form.releaseYear);
    const runtime = Number(form.runtime);
    const priority = Number(form.priority);

    if (!editing && (!Number.isInteger(year) ||
        year < 1950 || year > new Date().getFullYear())) {
      setError("Release year must be between 1950 and the current year.");
      return;
    }

    if (!Number.isInteger(runtime) || runtime < 30 || runtime > 300) {
      setError("Runtime must be between 30 and 300 minutes.");
      return;
    }

    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      setError("Priority must be between 1 and 5.");
      return;
    }

    setLoading(true);

    try {
      if (editing) {
        await axios.patch(`${API}/${editing._id}`, {
          title: form.title,
          genre: form.genre,
          runtime,
          platform: form.platform,
          priority
        });
        setNotice("Movie updated successfully.");
      } else {
        await axios.post(API, {
          ...form,
          releaseYear: year,
          runtime,
          priority
        });
        setNotice("Movie added successfully.");
      }

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      setPage(1);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save movie.");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(movie, newStatus) {
    setError("");
    setNotice("");

    try {
      if (newStatus === "Watched") {
        setRatingMovie(movie);
        setRating(8);
        return;
      }

      await axios.patch(`${API}/${movie._id}/status`, {
        status: newStatus
      });
      setNotice("Movie status updated.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Status update failed.");
    }
  }

  async function markWatched(event) {
    event.preventDefault();
    try {
      await axios.patch(`${API}/${ratingMovie._id}/status`, {
        status: "Watched",
        rating: Number(rating)
      });
      setRatingMovie(null);
      setNotice("Movie marked as watched.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update rating.");
    }
  }

  async function editRating(movie) {
    const value = window.prompt("Enter a rating from 1 to 10:", movie.rating);
    if (value === null) return;
    const number = Number(value);

    if (!Number.isInteger(number) || number < 1 || number > 10) {
      setError("Rating must be a whole number from 1 to 10.");
      return;
    }

    try {
      await axios.patch(`${API}/${movie._id}/rating`, { rating: number });
      setNotice("Rating updated.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Rating update failed.");
    }
  }

  async function deleteMovie(movie) {
    if (movie.status === "Watching") return;
    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/${movie._id}`);
      setNotice("Movie deleted.");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete movie.");
    }
  }

  async function watchNext() {
    setError("");
    setNextMovie(null);
    try {
      const response = await axios.get(`${API}/watch-next`);
      setNextMovie(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not find a movie.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon"><Film size={24} /></span>
          <span>Reel<span className="accent">List</span></span>
        </a>
        <button className="primary-button" onClick={startAdd}>
          <Plus size={18} /> Add Movie
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">YOUR PERSONAL CINEMA</span>
          <h1>Your next great<br />movie is <span className="accent">waiting.</span></h1>
          <p>Keep your watchlist organised. Discover your next favourite.</p>
          <button className="primary-button" onClick={watchNext}>
            <Play size={17} fill="currentColor" /> What should I watch next?
          </button>
        </div>
        <div className="hero-art"><Clapperboard size={100} strokeWidth={1} /></div>
      </section>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      {nextMovie && (
        <section className="next-card">
          <div>
            <span className="eyebrow">YOUR NEXT PICK</span>
            <h2>{nextMovie.title}</h2>
            <p>{nextMovie.genre} · {nextMovie.runtime} min · Priority {nextMovie.priority}/5</p>
            <p className="muted">Movie code: {nextMovie.movieCode}</p>
          </div>
          <button className="secondary-button" onClick={() => {
            setNextMovie(null);
            changeStatus(nextMovie, "Watching");
          }}>Start watching</button>
        </section>
      )}

      <section className="stats-grid">
        <Stat icon={<Clapperboard />} label="To Watch" value={stats?.statusCounts?.["To Watch"] ?? "—"} />
        <Stat icon={<Play />} label="Watching" value={stats?.statusCounts?.Watching ?? "—"} />
        <Stat icon={<Film />} label="Watched" value={stats?.statusCounts?.Watched ?? "—"} />
        <Stat icon={<Clock />} label="Hours Watched" value={stats?.totalHoursWatched ?? "—"} />
        <Stat icon={<Star />} label="Average Rating" value={stats?.averageRating ?? "—"} />
        <Stat icon={<Film />} label="Top Genre" value={stats?.topWatchedGenre?.genre ?? "—"} />
      </section>

      <section className="list-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR COLLECTION</span>
            <h2>Movie watchlist</h2>
          </div>
          <span className="muted">{movies.length} movies on this page</span>
        </div>

        <div className="filters">
          <label className="search-box">
            <Search size={18} />
            <input
              placeholder="Search movie titles..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option>To Watch</option>
            <option>Watching</option>
            <option>Watched</option>
          </select>
          <select value={genre} onChange={e => { setGenre(e.target.value); setPage(1); }}>
            <option value="">All genres</option>
            {genres.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div className="movie-grid">
          {movies.map(movie => (
            <article className="movie-card" key={movie._id}>
              <div className={`poster poster-${genres.indexOf(movie.genre) % 7}`}>
                <Film size={40} strokeWidth={1.2} />
                <span className="movie-code">{movie.movieCode}</span>
              </div>
              <div className="movie-content">
                <div className="movie-title-row">
                  <h3>{movie.title}</h3>
                  <span className={`priority p${movie.priority}`}>{movie.priority}/5</span>
                </div>
                <p className="muted">{movie.genre} · {movie.releaseYear}</p>
                <p className="muted"><Clock size={14} /> {movie.runtime} min · {movie.platform}</p>
                <div className="card-footer">
                  <span className={`status status-${movie.status.toLowerCase().replace(" ", "-")}`}>
                    {movie.status}
                  </span>
                  {movie.status === "Watched" && (
                    <button className="rating-button" onClick={() => editRating(movie)}>
                      <Star size={14} fill="currentColor" /> {movie.rating}/10
                    </button>
                  )}
                </div>

                <label className="status-control">
                  <span>Update status</span>
                  <select
                    value={movie.status}
                    disabled={movie.status === "Watched"}
                    onChange={e => changeStatus(movie, e.target.value)}
                  >
                    <option value={movie.status}>{movie.status}</option>
                    {movie.status === "To Watch" && <option>Watching</option>}
                    {movie.status === "To Watch" && <option>Watched</option>}
                    {movie.status === "Watching" && <option>To Watch</option>}
                    {movie.status === "Watching" && <option>Watched</option>}
                  </select>
                </label>

                <div className="card-actions">
                  <button onClick={() => startEdit(movie)}><Pencil size={15} /> Edit</button>
                  <button
                    disabled={movie.status === "Watching"}
                    onClick={() => deleteMovie(movie)}
                  ><Trash2 size={15} /> Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {movies.length === 0 && (
          <div className="empty-state">
            <Film size={38} />
            <h3>No movies found</h3>
            <p>Add a movie or adjust your filters to get started.</p>
            <button className="primary-button" onClick={startAdd}><Plus size={17} /> Add your first movie</button>
          </div>
        )}

        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span>Page {page} of {Math.max(totalPages, 1)}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop">
          <form className="movie-form" onSubmit={saveMovie}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{editing ? "UPDATE DETAILS" : "BUILD YOUR LIST"}</span>
                <h2>{editing ? "Edit movie" : "Add a movie"}</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setShowForm(false)}>×</button>
            </div>

            {error && <div className="alert error">{error}</div>}

            <label>Title
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </label>

            {!editing && <label>Release year
              <input
                type="number" required min="1950" max={new Date().getFullYear()}
                value={form.releaseYear}
                onChange={e => setForm({ ...form, releaseYear: e.target.value })}
              />
            </label>}

            <div className="form-row">
              <label>Genre
                <select value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })}>
                  {genres.map(g => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label>Runtime (minutes)
                <input type="number" required min="30" max="300" value={form.runtime}
                  onChange={e => setForm({ ...form, runtime: e.target.value })} />
              </label>
            </div>

            <div className="form-row">
              <label>Platform
                <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                  {platforms.map(p => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label>Priority
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>{p}{p === 5 ? " — Highest" : ""}</option>)}
                </select>
              </label>
            </div>

            {error && <p className="form-error">{error}</p>}
            <button className="primary-button full-button" disabled={loading}>
              {loading ? "Saving..." : editing ? "Save changes" : "Add movie"}
            </button>
          </form>
        </div>
      )}

      {ratingMovie && (
        <div className="modal-backdrop">
          <form className="movie-form rating-form" onSubmit={markWatched}>
            <div className="modal-heading">
              <div><span className="eyebrow">FINISHED WATCHING</span><h2>Rate {ratingMovie.title}</h2></div>
              <button type="button" className="close-button" onClick={() => setRatingMovie(null)}>×</button>
            </div>
            <p>Choose a rating from 1 to 10 to mark this movie as watched.</p>
            <label>Rating
              <select value={rating} onChange={e => setRating(e.target.value)}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}/10</option>)}
              </select>
            </label>
            <button className="primary-button full-button">Save rating and finish</button>
          </form>
        </div>
      )}

      <footer className="footer">REELLIST · YOUR PERSONAL CINEMA</footer>
    </main>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

export default App;
