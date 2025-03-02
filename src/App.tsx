import React, { useState } from 'react';
import { Calendar as CalendarIcon, LayoutGrid, Database } from 'lucide-react';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';
import { useNews } from './hooks/useNews';
import { DisplayNoNews } from './hooks/useNews';
// Calendar component
const CalendarComponent = ({ 
  selectedDate, 
  onDateSelect 
}: { 
  selectedDate: Date, 
  onDateSelect: (date: Date) => void 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Define the minimum and maximum allowed dates
  const minDate = new Date(2025, 0, 20); // January 20, 2025
  const maxDate = new Date(); // Current date

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };
  
  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    const firstDayOfNewMonth = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
    const firstDayOfMinMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    
    // Allow navigation if the new month is after or equal to the min month
    if (firstDayOfNewMonth >= firstDayOfMinMonth) {
      setCurrentMonth(newMonth);
    }
  };
  
  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    const firstDayOfNewMonth = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
    const firstDayOfMaxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    
    // Allow navigation if the new month is before or equal to the max month
    if (firstDayOfNewMonth <= firstDayOfMaxMonth) {
      setCurrentMonth(newMonth);
    }
  };

  // Check if the "Previous" button should be disabled
  const isPrevDisabled = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1) <= new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  // Check if the "Next" button should be disabled
  const isNextDisabled = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1) >= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  const renderCalendarDays = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }
    
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isToday = isSameDay(new Date(), date);
      const isSelected = isSameDay(selectedDate, date);
      const isDisabled = date > maxDate || date < minDate; // Disable dates outside the allowed range
      
      days.push(
        <div 
          key={day} 
          onClick={() => !isDisabled && onDateSelect(date)}
          className={`h-8 w-8 flex items-center justify-center rounded-full cursor-pointer
            ${isDisabled 
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
              : isSelected 
                ? 'bg-primary-light dark:bg-primary-dark text-white' 
                : isToday 
                  ? 'border border-primary-light dark:border-primary-dark' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
        >
          {day}
        </div>
      );
    }
    
    return days;
  };
  
  return (
    <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={prevMonth}
          disabled={isPrevDisabled}
          className={`p-2 rounded-full ${
            isPrevDisabled 
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
              : 'hover:bg-gray-200 dark:hover:bg-gray-600'
          } transition-colors duration-200`}
          aria-label="Previous month"
        >
          &lt;
        </button>
        <h2 className="text-lg font-semibold dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button 
          onClick={nextMonth}
          disabled={isNextDisabled}
          className={`p-2 rounded-full ${
            isNextDisabled 
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
              : 'hover:bg-gray-200 dark:hover:bg-gray-600'
          } transition-colors duration-200`}
          aria-label="Next month"
        >
          &gt;
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {renderCalendarDays()}
      </div>
    </div>
  );
};

// Card component
const ContentCard = ({ date, link, title, desc, news_source, image_url }: { 
  date: string; 
  link: string; 
  title: string; 
  desc: string; 
  news_source: string; 
  image_url: string; 
}) => {
  return (
    <a 
      href={link} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="block bg-card-light dark:bg-card-dark rounded-lg shadow-md mb-4 transition-colors duration-200 hover:shadow-lg"
    >
      <div className="flex flex-col md:flex-row">
        {/* Left side: Text content */}
        <div className="flex-1 p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-3">{desc}</p>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{date}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{news_source}</p>
          </div>
        </div>

        {/* Right side: Image */}
        {image_url && image_url !== 'No Image Available' && (
          <div className="w-full md:w-1/3 p-4 flex justify-center md:justify-end">
            <img 
              src={image_url} 
              alt={title} 
              className="w-full md:w-auto h-32 object-cover rounded-lg"
            />
          </div>
        )}
      </div>
    </a>
  );
};


function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { news, loading, error, noNewArticles } = useNews(selectedDate);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-md py-6 transition-colors duration-200">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-4xl font-bold text-center text-gray-800 dark:text-white">Trump of the day!</h1>
          <ThemeToggle />
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/3">
            <CalendarComponent selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            <div className="mt-4 p-3 bg-card-light dark:bg-card-dark rounded-lg shadow-md transition-colors duration-200">
              <p className="text-gray-700 dark:text-gray-300">
                Selected date: <span className="font-semibold">{format(selectedDate, 'MMMM d, yyyy')}</span>
              </p>
            </div>
          </div>
          
          <div className="md:w-2/3">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-light dark:border-primary-dark"></div>
              </div>
            ) : error ? (
              <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded relative">
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
                    desc={item.description} 
                    title={item.title}
                    news_source={item.news_source}
                    image_url={item.image_url}
                  />
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
