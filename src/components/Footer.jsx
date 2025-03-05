import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-10 mt-8 border-t border-gray-700">
      <div className="container mx-auto px-6 text-center space-y-4">
        
        {/* 🦅 Bold Title */}
        <h2 className="text-lg font-bold text-white tracking-wide">
          Trump Of The Day 🦅
        </h2>

        {/* ⭐ Divider */}
        <div className="w-24 border-b-2 border-gray-500 mx-auto"></div>

        {/* 🎭 Satirical Quote */}
        <p className="text-sm italic text-gray-400">
          "History repeats itself—sometimes daily."
        </p>

        {/* 🛠️ Made With Love */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Crafted with <span className="text-red-500 dark:text-yellow-400">❤️</span> using React & Tailwind CSS.
        </p>

        {/* ⚖️ Copyright & Info */}
        <p className="text-xs text-gray-500">
          &copy;{new Date().getFullYear()} Trump Of The Day. All rights reserved.  
        </p>

      </div>
    </footer>
  );
};

export default Footer;
