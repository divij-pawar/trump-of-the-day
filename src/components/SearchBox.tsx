import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, isAbortError, type SimilarItem } from "../lib/api";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: SimilarItem[] };

/** Semantic search over the whole archive (Voyage query embedding + pgvector). */
const SearchBox = ({ onPickDate }: { onPickDate: (date: string) => void }) => {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (query.length < 2) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    api
      .search(query, controller.signal)
      .then(({ items }) => setState({ status: "ready", items }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return;
        const message =
          err instanceof ApiError && err.status === 503 ? "Search isn't available right now." : "Search failed.";
        setState({ status: "error", message });
      });
    return () => controller.abort();
  }, [query]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(input.trim());
  };

  return (
    <div className="rounded-lg bg-white p-3 shadow-md dark:bg-gray-900">
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label htmlFor="search" className="sr-only">
          Search the archive
        </label>
        <input
          id="search"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search the archive, e.g. tariffs on Canada"
          maxLength={200}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-transparent px-2 py-1 text-gray-800 dark:border-gray-700 dark:text-gray-200"
        />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
          Search
        </button>
      </form>
      {state.status === "loading" && <p className="mt-2 text-sm text-gray-500">Searching…</p>}
      {state.status === "error" && <p className="mt-2 text-sm text-red-600">{state.message}</p>}
      {state.status === "ready" && (
        <ul className="mt-2 space-y-1 text-sm">
          {state.items.length === 0 && <li className="text-gray-500">No matches.</li>}
          {state.items.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-2">
              <a href={s.link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline dark:text-gray-200">
                {s.title}
              </a>
              <button type="button" onClick={() => onPickDate(s.date)} className="shrink-0 text-blue-600 hover:underline dark:text-blue-400">
                {s.date}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBox;
