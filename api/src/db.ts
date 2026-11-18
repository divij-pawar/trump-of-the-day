import pg from "pg";

export interface NewsItem {
  id: number;
  date: string;
  title: string;
  description: string | null;
  link: string;
  news_source: string | null;
  image_url: string | null;
  relevance_score: number | null;
}

/** One sentence of the brief and the news ids it cites. */
export interface DigestSentence {
  text: string;
  story_ids: number[];
}

export interface Digest {
  date: string;
  summary: string;
  /** The summary sentence by sentence with citations, one array per paragraph; null for briefs written without them. */
  paragraphs: DigestSentence[][] | null;
  top_story_ids: number[];
  model: string;
}

export interface SimilarItem extends NewsItem {
  distance: number;
}

/** Everything the routes need from Postgres; the interface lets tests swap in a fake. */
export interface NewsRepository {
  ping(): Promise<void>;
  newsByDate(date: string, limit: number): Promise<NewsItem[]>;
  digestByDate(date: string): Promise<Digest | null>;
  latestDate(): Promise<string | null>;
  similarTo(id: number, limit: number): Promise<SimilarItem[] | null>;
  searchByEmbedding(embedding: number[], limit: number): Promise<SimilarItem[]>;
  close(): Promise<void>;
}

// `date::text` keeps DATE columns as plain YYYY-MM-DD strings; node-pg would
// otherwise turn them into JS Dates at local midnight and shift them by the
// server's UTC offset when serialized.
const NEWS_COLUMNS = `id, date::text AS date, title, description, link, news_source,
  image_url, relevance_score`;

// node-pg returns BIGINT (BIGSERIAL ids) as strings. Ids stay far below 2^53,
// so Number is exact, and the frontend can compare them with top_story_ids.
function withNumericId<T extends { id: number | string }>(row: T): T {
  return { ...row, id: Number(row.id) };
}

/** pgvector accepts the same `[1,2,3]` text form JSON produces. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PgNewsRepository implements NewsRepository {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Fail a hung query instead of tying up a pool slot behind a load spike.
      statement_timeout: 5_000,
    });
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async newsByDate(date: string, limit: number): Promise<NewsItem[]> {
    const { rows } = await this.pool.query<NewsItem>(
      `SELECT ${NEWS_COLUMNS} FROM news
       WHERE date = $1
       ORDER BY relevance_score DESC NULLS LAST, id
       LIMIT $2`,
      [date, limit],
    );
    return rows.map(withNumericId);
  }

  async digestByDate(date: string): Promise<Digest | null> {
    const { rows } = await this.pool.query<Digest>(
      `SELECT date::text AS date, summary, paragraphs, top_story_ids, model
       FROM daily_digest WHERE date = $1`,
      [date],
    );
    const row = rows[0];
    if (!row) return null;
    // node-pg returns BIGINT[] elements as strings.
    return { ...row, top_story_ids: row.top_story_ids.map(Number) };
  }

  async latestDate(): Promise<string | null> {
    const { rows } = await this.pool.query<{ date: string | null }>(
      "SELECT max(date)::text AS date FROM news",
    );
    return rows[0]?.date ?? null;
  }

  async similarTo(id: number, limit: number): Promise<SimilarItem[] | null> {
    const source = await this.pool.query<{ has_embedding: boolean }>(
      "SELECT embedding IS NOT NULL AS has_embedding FROM news WHERE id = $1",
      [id],
    );
    if (source.rowCount === 0) return null;
    if (!source.rows[0]?.has_embedding) return [];

    const { rows } = await this.pool.query<SimilarItem>(
      `SELECT ${NEWS_COLUMNS}, n.embedding <=> src.embedding AS distance
       FROM news n, (SELECT embedding FROM news WHERE id = $1) src
       WHERE n.id <> $1 AND n.embedding IS NOT NULL
       ORDER BY n.embedding <=> src.embedding
       LIMIT $2`,
      [id, limit],
    );
    return rows.map(withNumericId);
  }

  async searchByEmbedding(embedding: number[], limit: number): Promise<SimilarItem[]> {
    const { rows } = await this.pool.query<SimilarItem>(
      `SELECT ${NEWS_COLUMNS}, embedding <=> $1::vector AS distance
       FROM news
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [toVectorLiteral(embedding), limit],
    );
    return rows.map(withNumericId);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
