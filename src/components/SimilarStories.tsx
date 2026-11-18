import { useEffect, useState } from "react";
import { api, isAbortError, type SimilarItem } from "../lib/api";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; items: SimilarItem[] };

/** Nearest neighbours by embedding (pgvector cosine distance), across all dates. */
const SimilarStories = ({ id }: { id: number }) => {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    api
      .similar(id, controller.signal)
      .then(({ items }) => setState({ status: "ready", items }))
      .catch((err: unknown) => {
        if (!isAbortError(err)) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [id]);

  if (state.status === "loading") return <p className="mt-2 text-sm text-gray-500">Loading…</p>;
  if (state.status === "error") return <p className="mt-2 text-sm text-red-600">Couldn't load related coverage.</p>;
  if (state.items.length === 0) return <p className="mt-2 text-sm text-gray-500">No related coverage yet.</p>;

  return (
    <ul className="mt-2 space-y-1 border-l-2 border-gray-300 pl-3 text-sm dark:border-gray-700">
      {state.items.map((s) => (
        <li key={s.id}>
          <a href={s.link} target="_blank" rel="noopener noreferrer" className="hover:underline dark:text-gray-200">
            {s.title}
          </a>{" "}
          <span className="text-gray-500">
            · {s.news_source} · {s.date}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default SimilarStories;
