import { formatLong, type ISODate } from "../lib/dates";

export const LoadingState = () => (
  <div className="flex justify-center p-8" role="status" aria-label="Loading stories">
    <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-blue-600" />
  </div>
);

export const EmptyState = ({ date, isToday }: { date: ISODate; isToday: boolean }) => (
  <div className="text-center text-gray-700 dark:text-gray-300">
    <h2 className="text-xl font-bold text-gray-800 dark:text-white">No stories for {formatLong(date)}</h2>
    {isToday && <p className="mt-2">Today's stories land after the daily update (around 14:00 UTC).</p>}
  </div>
);

/** Distinct from the empty state, so an outage doesn't read as "nothing happened that day". */
export const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div role="alert" className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700 dark:bg-red-900 dark:text-red-100">
    <p className="font-semibold">Couldn't load stories.</p>
    <p className="text-sm">{message}</p>
    <button type="button" onClick={onRetry} className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700">
      Try again
    </button>
  </div>
);
