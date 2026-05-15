import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    business_name: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Registration failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500">Set up your AI assistant</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {[
          { f: "username", label: "Username", type: "text", required: true },
          { f: "email", label: "Email", type: "email", required: true },
          { f: "password", label: "Password", type: "password", required: true },
          {
            f: "business_name",
            label: "Business name",
            type: "text",
            required: false,
          },
        ].map(({ f, label, type, required }) => (
          <div key={f}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <input
              type={type}
              value={form[f]}
              onChange={update(f)}
              required={required}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-md py-2 font-medium disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create account"}
        </button>

        <p className="text-sm text-center text-gray-500">
          Have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
