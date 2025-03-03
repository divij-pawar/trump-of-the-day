import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import { useNews } from './hooks/useNews';
import ThemeToggle from './components/ThemeToggle';
import { DisplayNoNews } from './hooks/useNews';

// 🎆 **Calendar Component**
const CalendarComponent = ({ selectedDate, onDateSelect }: { selectedDate: Date; onDateSelect: (date: Date) => void }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // **Minimum & Maximum Allowed Dates**
  const minDate = new Date(2025, 0, 20); // ✅ January 20, 2025
  const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(),1)
  const maxDate = new Date(); // ✅ Today
  const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(),31)

  // ✅ **Ensure calendar starts on selected date**
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    if (newMonth >= minMonth) setCurrentMonth(newMonth);
  };

  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    if (newMonth <= maxMonth) setCurrentMonth(newMonth);
  };

  const renderCalendarDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);

    // **Empty spots for first week alignment**
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    // **Render Days**
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isToday = isSameDay(new Date(), date);
      const isSelected = isSameDay(selectedDate, date);
      const isDisabled = date > maxDate || date < minDate;

      days.push(
        <div 
          key={day} 
          onClick={() => !isDisabled && onDateSelect(date)}
          className={`h-8 w-8 flex items-center justify-center rounded-full cursor-pointer
            ${isDisabled ? 'text-gray-400 cursor-not-allowed' 
              : isSelected ? 'bg-blue-600 text-white' 
              : isToday ? 'border border-red-500' 
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
          `}
        >
          {day}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white dark:bg-gray-900 shadow-lg rounded-lg p-4 border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} disabled={currentMonth <= minDate} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          ◀️
        </button>
        <h2 className="text-lg font-bold text-red-600 dark:text-yellow-400">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={nextMonth} disabled={currentMonth >= maxDate} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          ▶️
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-gray-700 dark:text-gray-400">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="font-bold">{d}</div>
        ))}
        {[...Array(firstDayOfMonth(currentMonth))].map((_, i) => (
          <div key={i} className="h-10 w-10 opacity-0"></div>
        ))}
        {renderCalendarDays()}
      </div>
    </div>
  );
};

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

// 🦅 **Main App Component**
function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { news, loading, error, noNewArticles } = useNews(selectedDate);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-l from-red-600 via-white to-blue-600 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all overflow-hidden">
      
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
      <main className="container mx-auto px-4 py-8 relative">
        <div className="flex flex-col md:flex-row gap-8">
          {/* **Left: Calendar** */}
          <div className="md:w-1/3">
            <CalendarComponent selectedDate={selectedDate} onDateSelect={setSelectedDate} />
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
                  <ContentCard key={item.id} date={item.date} link={item.link} desc={item.description} title={item.title} news_source={item.news_source} image_url={item.image_url} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


export default App;
