import React, { useState } from 'react';
import { format } from 'date-fns';
import { useNews } from './hooks/useNews';
import ThemeToggle from './components/ThemeToggle';
import { DisplayNoNews } from './hooks/useNews';
import Footer from './components/Footer';
import ContentCard from './components/ContentCard';
import Calendar from './components/Calendar';

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { news, loading, error, noNewArticles } = useNews(selectedDate);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-l from-red-600 via-white to-blue-600 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all overflow-hidden flex flex-col">
      
      {/* 🌟 Star Overlay for US Flag Effect */}
      <div className="absolute inset-0 w-full h-full bg-stars-pattern opacity-40 animate-waving"></div>

      {/* **Header with Eagle & Flag** */}
      <header className="relative py-6 shadow-md flex items-center justify-center bg-opacity-80">
        <h1 className="trump-title font-extrabold text-white drop-shadow-lg text-center"> Trump Of The Day 🦅</h1>
        <div className="absolute right-6">
          <ThemeToggle />
        </div>
      </header>

      {/* **Main Content** */}
      <main className="container mx-auto px-4 py-8 relative flex-grow">
        <div className="flex flex-col md:flex-row gap-8">
          {/* **Left: Calendar** */}
          <div className="md:w-1/3">
            <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-md">
              <p className="text-gray-700 dark:text-gray-300">
                Selected date: <span className="font-semibold">{format(selectedDate, 'MMMM d, yyyy')}</span>
              </p>
            </div>
          </div>

          {/* **Right: News Section** */}
          <div className="md:w-2/3">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{error}</p>
              </div>
            ) : noNewArticles ? (
              <DisplayNoNews date={selectedDate} />
            ) : (
              <div className="space-y-4">
                {news.map((item) => (
                  <ContentCard
                    key={item.id}
                    date={item.date}
                    link={item.link}
                    title={item.title}
                    desc={item.description}
                    news_source={item.news_source}
                    image_url={item.image_url}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;