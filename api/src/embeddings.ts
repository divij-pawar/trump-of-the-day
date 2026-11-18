/**
 * Query-side embeddings for semantic search. The pipeline embeds articles with the
 * same model (input_type "document"), so query and document vectors share a space.
 * Keep EMBEDDING_MODEL in sync with trump-of-the-day-server/lib/embeddings.py.
 */
export const EMBEDDING_MODEL = "voyage-3.5";
export const EMBEDDING_DIMENSIONS = 1024;

export type Embedder = (text: string) => Promise<number[]>;

export function voyageEmbedder(apiKey: string): Embedder {
  return async (text: string) => {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: [text], model: EMBEDDING_MODEL, input_type: "query" }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      throw new Error(`Voyage embeddings request failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { data: { embedding: number[] }[] };
    const embedding = body.data[0]?.embedding;
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error("Voyage returned an unexpected embedding shape");
    }
    return embedding;
  };
}
