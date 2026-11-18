import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DigestCard from "./DigestCard";
import type { Digest, DigestSentence, NewsItem } from "../lib/api";
import { numberCitations, storyElementId } from "../lib/citations";
import { describeModel } from "../lib/models";

const digest = (model: string, paragraphs: DigestSentence[][] | null = null): Digest => ({
  date: "2025-03-01",
  summary: "First paragraph.\n\nSecond paragraph.",
  paragraphs,
  top_story_ids: [1],
  model,
});

const story = (id: number): NewsItem => ({
  id,
  date: "2025-03-01",
  title: `Headline ${id}`,
  description: null,
  link: `https://example.com/${id}`,
  news_source: `pub${id}.com`,
  image_url: null,
  relevance_score: null,
});

const byId = (...ids: number[]) => new Map(ids.map((id) => [id, story(id)]));

describe("describeModel", () => {
  it("credits OpenRouter free models without the :free suffix", () => {
    expect(describeModel("upstage/solar-pro-3:free")).toEqual({
      name: "upstage/solar-pro-3",
      via: "free model via OpenRouter",
    });
  });

  it("credits Claude and passes other ids through", () => {
    expect(describeModel("claude-haiku-5-5")).toEqual({ name: "claude-haiku-5-5", via: "Anthropic" });
    expect(describeModel("seed")).toEqual({ name: "seed", via: null });
  });
});

describe("numberCitations", () => {
  it("numbers stories by first citation and skips ones not on the page", () => {
    const d = digest("m", [
      [
        { text: "A.", story_ids: [7, 3] },
        { text: "B.", story_ids: [3, 99] },
      ],
      [{ text: "C.", story_ids: [5, 7] }],
    ]);
    expect([...numberCitations(d, new Set([3, 5, 7]))]).toEqual([
      [7, 1],
      [3, 2],
      [5, 3],
    ]);
  });

  it("is empty for briefs written without citations", () => {
    expect(numberCitations(digest("m"), new Set([1])).size).toBe(0);
  });
});

describe("DigestCard", () => {
  it("shows the summary paragraphs and the model that wrote them", () => {
    render(<DigestCard digest={digest("upstage/solar-pro-3:free")} citations={new Map()} storiesById={byId()} />);
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText("upstage/solar-pro-3")).toBeInTheDocument();
    expect(screen.getByText(/free model via OpenRouter/)).toBeInTheDocument();
  });

  it("links each sentence to the stories it cites, and jumps to the card on click", () => {
    const d = digest("m", [[{ text: "Senate vows a fight.", story_ids: [4, 2] }]]);
    const stories = byId(2, 4);
    const card = document.createElement("article");
    card.id = storyElementId(2);
    card.tabIndex = -1;
    card.scrollIntoView = vi.fn();
    document.body.appendChild(card);

    render(<DigestCard digest={d} citations={numberCitations(d, new Set(stories.keys()))} storiesById={stories} />);

    expect(screen.getByText("Senate vows a fight.")).toBeInTheDocument();
    const first = screen.getByRole("link", { name: "Source 1: Headline 4 (pub4.com)" });
    expect(first).toHaveAttribute("href", "#story-4");
    const second = screen.getByRole("link", { name: "Source 2: Headline 2 (pub2.com)" });

    fireEvent.click(second);
    expect(card.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(card);
    card.remove();
  });
});
