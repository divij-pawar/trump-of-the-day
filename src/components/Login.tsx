import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { reload } = useAuth();
  
  // Use the environment variable for server URL
  const SERVER_URL = import.meta.env.VITE_SERVER_URL;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
  
    const res = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
  
    const data = await res.json();
  
    if (!res.ok) {
      setError(data.error || "Login failed");
    } else {
      // ✅ Force reload to reinitialize user session from cookies
      window.location.href = "/";
    }
  };
  
  return (
    <>
      <div className="max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="email" type="email" placeholder="Email" onChange={handleChange} className="w-full border p-2 rounded" />
          <input name="password" type="password" placeholder="Password" onChange={handleChange} className="w-full border p-2 rounded" />
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Login</button>
        </form>
        {error && <p className="text-red-600 mt-2">{error}</p>}

        <div className="mt-6 text-center">
          <p className="mb-2 text-sm text-gray-500">or continue with</p>
          <button
            onClick={() => window.location.href = `${SERVER_URL}/api/auth/google`}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Continue with Google
          </button>
          <button 
            onClick={() => window.location.href = `${SERVER_URL}/api/auth/facebook`}
            className="bg-blue-800 text-white px-4 py-2 rounded mt-2"
          >
            Continue with Facebook
          </button>
        </div>
      </div>
    </>
  );
}