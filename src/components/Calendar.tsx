import { format, addMonths, subMonths, isSameDay } from 'date-fns';
import React, { useState, useEffect } from 'react';

// 🎆 **Calendar Component**
const Calendar = ({ selectedDate, onDateSelect }: { selectedDate: Date; onDateSelect: (date: Date) => void }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
  
    // **Minimum & Maximum Allowed Dates**
    const minDate = new Date(2025, 0, 20); // ✅ January 20, 2025
    const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const maxDate = new Date(); // ✅ Today
    const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 31);
  
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

export default Calendar;