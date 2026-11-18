import { useCallback, useMemo, useState } from "react";
import Footer from "./components/Footer";
import ContentCard from "./components/ContentCard";
import Calendar from "./components/Calendar";
import DigestCard from "./components/DigestCard";
import Metadata from "./components/Metadata";
import Header from "./components/Header";
import SearchBox from "./components/SearchBox";
import { EmptyState, ErrorState, LoadingState } from "./components/NewsStates";
import { useTheme } from "./context/ThemeContext";
import { useLatestDate } from "./hooks/useLatestDate";
import { useLiveUpdates } from "./hooks/useLiveUpdates";
import { useNews } from "./hooks/useNews";
import type { Digest, NewsItem } from "./lib/api";
import { numberCitations } from "./lib/citations";
import { clampDate, FIRST_DAY, formatLong, isValidISODate, todayUTC, type ISODate } from "./lib/dates";

/** The brief and the day's stories, with the brief's citations numbered and linked to the cards. */
function DayStories({ digest, items }: { digest: Digest | null; items: NewsItem[] }) {
  const storiesById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const citations = useMemo(
    () => (digest ? numberCitations(digest, new Set(storiesById.keys())) : new Map<number, number>()),
    [digest, storiesById],
  );

  return (
    <div className="space-y-4">
      {digest && <DigestCard digest={digest} citations={citations} storiesById={storiesById} />}
      {items.map((item) => (
        <ContentCard
          key={item.id}
          item={item}
          highlighted={digest?.top_story_ids.includes(item.id)}
          citation={citations.get(item.id)}
        />
      ))}
    </div>
  );
}

function App() {
  const { theme } = useTheme();
  const today = todayUTC();
  const [latestDate, setLatestDate] = useLatestDate();
  const [pickedDate, setPickedDate] = useState<ISODate | null>(null);
  // Until the visitor picks a day, follow the newest day that has stories.
  const selectedDate = pickedDate ?? latestDate;
  const { state, reload } = useNews(selectedDate);

  useLiveUpdates(
    useCallback(
      (date: ISODate) => {
        if (latestDate && date > latestDate) setLatestDate(date);
        if (date === selectedDate) reload();
      },
      [latestDate, selectedDate, setLatestDate, reload],
    ),
  );

  const pickDate = (date: string) => {
    if (isValidISODate(date)) setPickedDate(clampDate(date, FIRST_DAY, today));
  };

  return (
    <div
      className={`relative flex min-h-screen w-full flex-col overflow-x-hidden transition-all ${
        theme === "dark" ? "bg-theme-dark" : "bg-theme-light"
      }`}
    >
      <Metadata
        title="Trump Of The Day 🦅"
        description="Your daily dose of news and updates about Trump."
        imagePath="/eagle.webp"
      />

      <Header />

      <main className="container relative mx-auto flex-grow px-4 py-8 pt-20 md:pt-24">
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="space-y-4 md:w-1/3">
            {selectedDate && (
              <>
                <Calendar selectedDate={selectedDate} onDateSelect={pickDate} maxDate={today} today={today} />
                <div className="rounded-lg bg-white p-3 shadow-md dark:bg-gray-900">
                  <p className="text-gray-700 dark:text-gray-300">
                    Selected date: <span className="font-semibold">{formatLong(selectedDate)}</span>
                  </p>
                </div>
              </>
            )}
            <SearchBox onPickDate={pickDate} />
          </div>

          <div className="md:w-2/3" aria-live="polite" aria-busy={state.status === "loading"}>
            {!selectedDate || state.status === "loading" ? (
              <LoadingState />
            ) : state.status === "error" ? (
              <ErrorState message={state.message} onRetry={reload} />
            ) : state.status === "empty" ? (
              <EmptyState date={selectedDate} isToday={selectedDate === today} />
            ) : (
              <DayStories digest={state.digest} items={state.items} />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
