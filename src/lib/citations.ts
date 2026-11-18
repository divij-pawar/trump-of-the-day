import type { Digest } from "./api";

/** The id of a story card on the page, the target of a citation link. */
export const storyElementId = (id: number) => `story-${id}`;

/**
 * Footnote numbers for the brief's citations: 1, 2, 3… in order of first
 * appearance. Stories that aren't on the page are skipped, so every number
 * links to a card the reader can jump to.
 */
export function numberCitations(digest: Digest, storyIdsOnPage: ReadonlySet<number>): Map<number, number> {
  const numbers = new Map<number, number>();
  for (const paragraph of digest.paragraphs ?? []) {
    for (const sentence of paragraph) {
      for (const id of sentence.story_ids) {
        if (storyIdsOnPage.has(id) && !numbers.has(id)) numbers.set(id, numbers.size + 1);
      }
    }
  }
  return numbers;
}

/** Scroll a cited story into view and move focus to it, which also highlights it. */
export function jumpToStory(id: number): void {
  const card = document.getElementById(storyElementId(id));
  if (!card) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  card.focus({ preventScroll: true });
}
