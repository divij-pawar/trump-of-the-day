import React from 'react';

const DayNavigation = ({ selectedDate, onDateSelect }) => {
  const handlePreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(selectedDate.getDate() - 1);
    onDateSelect(previousDay);
  };

  const handleNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    onDateSelect(nextDay);
  };

  return (
    <div className="flex justify-center gap-4 mt-8 mb-8">
      <button
        onClick={handlePreviousDay}
        className="bg-black text-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-800 transition-all"
      >
        ◀️ Previous Day
      </button>
      <button
        onClick={handleNextDay}
        className="bg-black text-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-800 transition-all"
      >
        Next Day ▶️
      </button>
    </div>
  );
}

export default DayNavigation;