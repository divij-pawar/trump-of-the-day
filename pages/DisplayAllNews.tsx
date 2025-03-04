import React from "react";
import { useAllNews } from "../src/hooks/useAllNews";
import ContentCard from "../src/components/ContentCard";
import Footer from "../src/components/Footer";
import Header from "../src/components/Header";


function DisplayAllNews() {
  const { news, loading, error, noNewArticles } = useAllNews();
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-l from-red-600 via-white to-blue-600 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all overflow-hidden flex flex-col">
      {/* 🌟 Star Overlay for US Flag Effect */}
      <div className="absolute inset-0 w-full h-full bg-stars-pattern opacity-40 animate-waving"></div>

      <Header />

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
          <p className="text-gray-700 dark:text-gray-300 text-center">
            No news articles found for this date.
          </p>
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

      <Footer />
    </div>
  );
}

export default DisplayAllNews;
