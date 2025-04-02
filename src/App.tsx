import React, { useState } from "react";
import { format } from "date-fns";
import { useNews, DisplayNoNews } from "./hooks/useNews";
import Footer from "./components/Footer";
import ContentCard from "./components/ContentCard";
import Calendar from "./components/Calendar";
import Metadata from "./components/Metadata";
import Header from "./components/Header";
import { useTheme } from "./context/ThemeContext";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Profile from "./components/Profile";
import UsersList from "./components/UsersList";
import Signup from "./components/Signup";

function HomePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { news, loading, error, noNewArticles } = useNews(selectedDate);
  const { theme } = useTheme();

  return (
    <div className={`relative min-h-screen w-full ${theme === "dark" ? "bg-theme-dark" : "bg-theme-light"} transition-all overflow-hidden flex flex-col`}>
      <Metadata
        title="Trump Of The Day 🦅"
        description="Your daily dose of news and updates about Trump."
        image="eagle.webp"
        url="https://trumpoftheday.com"
        keywords="trump, news, politics, daily updates"
        author="Trump Of The Day"
        canonicalUrl="https://trumpoftheday.com"
        ogType="website"
        ogSiteName="Trump Of The Day"
        ogArticlePublishedTime="2025-03-03T12:00:00Z"
        ogArticleTags={["trump", "politics", "news"]}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Trump Of The Day 🦅",
          description: "Your daily dose of news and updates about Trump.",
          url: "https://trumpoftheday.com",
          publisher: {
            "@type": "Organization",
            name: "Trump Of The Day",
            logo: {
              "@type": "ImageObject",
              url: "eagle.webp",
            },
          },
        }}
      />

      <Header />

      <main className="container mx-auto px-4 py-8 relative flex-grow pt-20 md:pt-24 lg:pt-24">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/3">
            <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-lg shadow-md">
              <p className="text-gray-700 dark:text-gray-300">
                Selected date:{" "}
                <span className="font-semibold">
                  {format(selectedDate, "MMMM d, yyyy")}
                </span>
              </p>
            </div>
          </div>

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

function App() {
  return (
    <Router>
      <Header /> 
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<UsersList />} />
      </Routes>
    </Router>
  );
}

export default App;
