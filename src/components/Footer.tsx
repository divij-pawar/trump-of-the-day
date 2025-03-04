import React from "react";

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-300 dark:border-gray-700 mt-8 py-6">
      <div className="container mx-auto px-4">
        <div className="text-center text-gray-700 dark:text-gray-400">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Trump Of The Day. All rights
            reserved. 🦅
          </p>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-500">
            Made with{" "}
            <span className="text-red-600 dark:text-yellow-400">❤️</span>
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
            Powered by React, Tailwind CSS, and the spirit of freedom.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
