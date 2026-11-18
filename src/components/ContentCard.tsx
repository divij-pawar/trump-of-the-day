import { useState } from "react";
import type { NewsItem } from "../lib/api";
import { storyElementId } from "../lib/citations";
import SimilarStories from "./SimilarStories";

interface ContentCardProps {
  item: NewsItem;
  highlighted?: boolean;
  /** Footnote number when the day's brief cites this story. */
  citation?: number;
}

const ContentCard = ({ item, highlighted = false, citation }: ContentCardProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);
  const showImage = item.image_url && item.image_url !== "No Image Available" && !imageFailed;

  return (
    <article
      id={storyElementId(item.id)}
      // Focusable from script only, so a citation link in the brief can move focus here.
      tabIndex={-1}
      className={`scroll-mt-4 rounded-lg bg-white p-4 shadow-md outline-none transition-all hover:shadow-xl focus:ring-4 focus:ring-blue-500 dark:bg-gray-900 dark:focus:ring-blue-400 ${
        highlighted ? "ring-2 ring-yellow-400" : ""
      }`}
    >
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-4 md:flex-row">
        <div className="min-w-0 flex-1">
          {(highlighted || citation) && (
            <div className="mb-1 flex flex-wrap gap-2">
              {citation && (
                <span className="inline-block rounded bg-blue-600 px-2 py-0.5 text-xs font-bold text-white dark:bg-blue-500">
                  Cited in brief [{citation}]
                </span>
              )}
              {highlighted && (
                <span className="inline-block rounded bg-yellow-400 px-2 py-0.5 text-xs font-bold text-gray-900">
                  Top story
                </span>
              )}
            </div>
          )}
          <h3 className="mb-2 break-words font-comic text-2xl font-bold text-blue-600 dark:text-yellow-400">
            {item.title}
          </h3>
          {item.description && (
            <p className="mb-3 font-comic text-gray-600 dark:text-gray-300">{item.description}</p>
          )}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{item.date}</span>
            <span className="truncate pl-4">{item.news_source}</span>
          </div>
        </div>
        {showImage && (
          <div className="flex w-full justify-center md:w-1/3">
            <img
              src={item.image_url!}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="h-32 rounded-lg object-cover shadow-md"
            />
          </div>
        )}
      </a>
      <button
        type="button"
        onClick={() => setShowSimilar((v) => !v)}
        aria-expanded={showSimilar}
        className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {showSimilar ? "Hide related coverage" : "Related coverage"}
      </button>
      {showSimilar && <SimilarStories id={item.id} />}
    </article>
  );
};

export default ContentCard;
