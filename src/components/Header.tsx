import React from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";


const Header = () => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate("/all-news"); // Replace with the path you want to navigate to
  };

  return (
    <header className="relative py-6 shadow-md flex items-center justify-center bg-opacity-80">
      <h1 className="trump-title font-extrabold text-white drop-shadow-lg text-center">
        {" "}
        Trump Of The Day 🦅
      </h1>
      <div className="absolute right-6 flex items-center space-x-4">
        <button
          onClick={handleNavigate}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300"
        >
          Go to Another Page
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;