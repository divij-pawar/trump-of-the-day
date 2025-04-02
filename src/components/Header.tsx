import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import { Link } from "react-router-dom";
import AuthModal from "./AuthModal";

export default function Header() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  const handleLogout = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/logout`;
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-md">
        <div className="relative max-w-7xl mx-auto px-4 py-4 flex items-center">
          {/* 🦅 Centered Logo */}
          <Link
            to="/"
            className="trump-title absolute left-1/2 transform -translate-x-1/2 text-2xl md:text-3xl font-bold text-white whitespace-nowrap"
            >
              Trump Of The Day 🦅
            </Link>


          {!loading && (
            <nav className="ml-auto flex items-center gap-4 text-sm font-medium">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(!openDropdown)}
                    className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                  >
                    <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full" />
                    <span>{user.name.split(" ")[0]}</span>
                  </button>

                  {openDropdown && (
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border rounded shadow z-50">
                      <Link
                        to="/profile"
                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-gray-700 dark:text-gray-200 hover:text-blue-600"
                >
                  Login / Signup
                </button>
              )}

              {/* 🌙 Theme Toggle */}
              <button onClick={toggleTheme}>
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
