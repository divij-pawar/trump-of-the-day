import React from 'react';

// 📰 **News Card Component**
const ContentCard = ({ date, link, title, desc, news_source, image_url }: { date: string; link: string; title: string; desc: string; news_source: string; image_url: string }) => {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="block bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-xl p-4 transition-all">
        <div className="flex flex-col md:flex-row">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-blue-600 dark:text-yellow-400 mb-2 font-comic">{title}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-3 font-comic">{desc}</p>
            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{date}</span>
              <span>{news_source}</span>
            </div>
          </div>
          {image_url !== 'No Image Available' && (
            <div className="w-full md:w-1/3 flex justify-center">
              <img src={image_url} alt={title} className="h-32 object-cover rounded-lg shadow-md" />
            </div>
          )}
        </div>
      </a>
    );
  };

export default ContentCard;