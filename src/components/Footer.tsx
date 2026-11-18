const Footer = () => {
  return (
    <footer className="mt-8 border-t border-gray-700 bg-gray-900 py-10 text-gray-300">
      <div className="container mx-auto space-y-4 px-6 text-center">
        {/* 🦅 Bold Title */}
        <h2 className="text-lg font-bold tracking-wide text-white">Trump Of The Day 🦅</h2>

        {/* ⭐ Divider */}
        <div className="mx-auto w-24 border-b-2 border-gray-500"></div>

        {/* 🎭 Satirical Quote */}
        <p className="text-sm italic text-gray-400">"History repeats itself—sometimes daily."</p>

        {/* 🛠️ Made With Love */}
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Crafted with <span className="text-red-500 dark:text-yellow-400">❤️</span> using React, TypeScript, Tailwind
          CSS, Fastify, Redis & Neon. Headlines link to their original publishers.
        </p>

        {/* ⚖️ Copyright & Info */}
        <p className="text-xs text-gray-500">&copy;{new Date().getFullYear()} Trump Of The Day. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
