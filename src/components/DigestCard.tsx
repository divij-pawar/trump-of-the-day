import type { Digest, NewsItem } from "../lib/api";
import { jumpToStory, storyElementId } from "../lib/citations";
import { formatLong } from "../lib/dates";
import { describeModel } from "../lib/models";

interface DigestCardProps {
  digest: Digest;
  /** Footnote number per cited story id (lib/citations numberCitations). */
  citations: Map<number, number>;
  /** The day's stories, for the citation tooltips. */
  storiesById: Map<number, NewsItem>;
}

/** The curated "Trump of the Day": an LLM-written summary of the day's top stories. */
const DigestCard = ({ digest, citations, storiesById }: DigestCardProps) => {
  const model = describeModel(digest.model);

  const cite = (id: number) => {
    const n = citations.get(id);
    const story = storiesById.get(id);
    if (!n || !story) return null;
    const source = story.news_source ? ` (${story.news_source})` : "";
    return (
      <sup key={id} className="ml-0.5">
        <a
          href={`#${storyElementId(id)}`}
          onClick={(e) => {
            e.preventDefault();
            jumpToStory(id);
          }}
          title={`${story.title}${source}`}
          aria-label={`Source ${n}: ${story.title}${source}`}
          className="rounded px-0.5 font-semibold text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-yellow-400"
        >
          [{n}]
        </a>
      </sup>
    );
  };

  return (
    <section
      aria-labelledby="digest-heading"
      className="rounded-lg border-l-4 border-red-600 bg-white p-5 shadow-md dark:border-yellow-400 dark:bg-gray-900"
    >
      <h2 id="digest-heading" className="mb-2 text-sm font-bold uppercase tracking-wide text-red-600 dark:text-yellow-400">
        The day in brief · {formatLong(digest.date)}
      </h2>
      <div className="space-y-2 text-gray-800 dark:text-gray-200">
        {digest.paragraphs
          ? digest.paragraphs.map((sentences, i) => (
              <p key={i}>
                {sentences.map((sentence, j) => (
                  <span key={j}>
                    {j > 0 && " "}
                    {sentence.text}
                    {sentence.story_ids.map(cite)}
                  </span>
                ))}
              </p>
            ))
          : digest.summary.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Summarized by{" "}
        <code className="break-all rounded bg-gray-100 px-1 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {model.name}
        </code>
        {model.via && <> ({model.via})</>}.{" "}
        {citations.size > 0
          ? "AI-generated from the headlines below; the numbers link to the stories each sentence is based on."
          : "AI-generated from the headlines below; check the linked sources."}
      </p>
    </section>
  );
};

export default DigestCard;
