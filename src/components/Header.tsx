import React from "react";
import ThemeToggle from "./ThemeToggle";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 w-full bg-gradient-to-b from-gray-900 to-gray-800 shadow-md h-16 md:h-20 lg:h-20 flex items-center justify-center px-6 z-50">
      {/* Logo-like Title (ALWAYS CENTERED) */}
      <h1 className="trump-title absolute left-1/2 transform -translate-x-1/2 text-white font-bold tracking-wide text-xl md:text-4xl lg:text-4xl leading-tight scale-y-125 whitespace-nowrap">
        Trump Of The Day 🦅
      </h1>

      {/* Theme Toggle (ALWAYS ON EXTREME RIGHT) */}
      <div className="absolute right-6">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
