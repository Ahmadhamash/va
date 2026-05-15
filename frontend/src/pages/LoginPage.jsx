import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500">Sign in to your assistant</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-md py-2 font-medium disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-sm text-center text-gray-500">
          No account?{" "}
          <Link to="/register" className="text-brand-600 font-medium">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
