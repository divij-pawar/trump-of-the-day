import React, { useState } from 'react';
import { Calendar as CalendarIcon, LayoutGrid, Database } from 'lucide-react';
import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './context/ThemeContext';
import { useNews } from './hooks/useNews';

// Calendar component
const CalendarComponent = ({ 
  selectedDate, 
  onDateSelect 
}: { 
  selectedDate: Date, 
  onDateSelect: (date: Date) => void 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };
  
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
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
      
      days.push(
        <div 
          key={day} 
          onClick={() => onDateSelect(date)}
          className={`h-8 w-8 flex items-center justify-center rounded-full cursor-pointer
            ${isSelected 
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
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          aria-label="Previous month"
        >
          &lt;
        </button>
        <h2 className="text-lg font-semibold dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button 
          onClick={nextMonth}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
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
const ContentCard = ({ date, link, title, desc }: { date: string; link: string; title: string; desc: string }) => {
  return (
    <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-md p-4 mb-4 transition-colors duration-200">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
        <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {title}
        </a>
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-3">{desc}</p>
    </div>
  );
};

// Supabase connection banner
const SupabaseBanner = ({ isUsingMockData }: { isUsingMockData: boolean }) => {
  if (!isUsingMockData) return null;
  
  return (
    <div className="bg-blue-100 dark:bg-blue-900 border border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg mb-6">
      <div className="flex items-start">
        <Database className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Using sample data</p>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { news, loading, error, isUsingMockData } = useNews(selectedDate);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-md py-6 transition-colors duration-200">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-4xl font-bold text-center text-gray-800 dark:text-white">Trump of the day</h1>
          <ThemeToggle />
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <SupabaseBanner isUsingMockData={isUsingMockData} />
        
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
            ) : (
              <div className="space-y-4">
                {news.map((item) => (
                  <ContentCard key={item.id} date={item.date} link={item.link} desc={item.description} title={item.title}/>
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