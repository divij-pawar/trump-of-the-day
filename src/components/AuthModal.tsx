import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const { reload } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const endpoint = isLogin ? "login" : "signup";
    const body = isLogin
      ? { email: form.email, password: form.password }
      : { name: form.name, email: form.email, password: form.password };

    const res = await fetch(`http://localhost:3001/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      reload();
      onClose();
      window.location.href = "/"; // Force hydration
    }
  };

  const handleGoogle = () => {
    window.location.href = "http://localhost:3001/api/auth/google";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 px-8 py-10 rounded-lg shadow-xl w-full max-w-lg min-h-[480px] relative">

        <button className="absolute top-2 right-3 text-xl text-gray-500 dark:text-gray-300" onClick={onClose}>
          ✖
        </button>

        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-yellow-400">
          {isLogin ? "Log In" : "Sign Up"}
        </h2>

        <div className="space-y-4">
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded py-2 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <img src="/google-icon.webp" alt="Google" className="w-5 h-5 mr-2" />
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
                OR
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <input
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-white text-gray-800 placeholder-gray-500 dark:bg-gray-900 dark:text-yellow-400 dark:placeholder-yellow-500"
                required
              />
            )}
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="w-full p-2 border rounded bg-white text-gray-800 placeholder-gray-500 dark:bg-gray-900 dark:text-yellow-400 dark:placeholder-yellow-500"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full p-2 border rounded bg-white text-gray-800 placeholder-gray-500 dark:bg-gray-900 dark:text-yellow-400 dark:placeholder-yellow-500"
              required
            />

            <button
              type="submit"
              className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
            >
              {isLogin ? "Log In" : "Sign Up"}
            </button>

            {error && <p className="text-red-600 mt-2">{error}</p>}
          </form>
        </div>

        <p className="text-center mt-4 text-gray-700 dark:text-yellow-400">
          {isLogin ? "New to Trump of the Day?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 dark:text-yellow-300 underline"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
