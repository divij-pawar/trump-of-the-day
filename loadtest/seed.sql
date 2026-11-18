-- Synthetic data for local development and load tests: 40 stories a day from
-- 2025-01-20 through today, each with a random embedding, plus a digest per day.
-- Roughly matches the real table's shape and size (~25k rows).

-- Building the HNSW index once after the load is much faster than updating it
-- row by row during the insert.
DROP INDEX IF EXISTS news_embedding_idx;

INSERT INTO news (created_at, date, title, description, link, news_source, image_url, relevance_score, embedding)
SELECT
    now(),
    d::date,
    'Synthetic headline ' || n || ' for ' || d::date,
    'A synthetic description used for local testing. Story ' || n || '.',
    'https://example.com/' || to_char(d, 'YYYYMMDD') || '/' || n,
    (ARRAY['apnews.com', 'reuters.com', 'politico.com', 'thehill.com', 'example.com'])[1 + n % 5],
    CASE WHEN n % 3 = 0 THEN '' ELSE 'https://picsum.photos/seed/' || n || '/400/240' END,
    round((random() * 8)::numeric, 2),
    -- `n * 0` ties the subquery to the outer row so each row gets its own vector;
    -- `g * 0` keeps array_agg an aggregate of the subquery. Without it, the
    -- argument only references the outer query, so Postgres treats it as an
    -- outer-level aggregate and rejects it.
    (SELECT array_agg(random() + n * 0 + g * 0)::vector FROM generate_series(1, 1024) AS g)
FROM generate_series('2025-01-20'::date, current_date, interval '1 day') AS d,
     generate_series(1, 40) AS n;

INSERT INTO daily_digest (date, summary, top_story_ids, model)
SELECT date, 'Synthetic digest for ' || date || E'.\n\nSecond paragraph.', array_agg(id ORDER BY relevance_score DESC), 'seed'
FROM (
    SELECT date, id, relevance_score,
           row_number() OVER (PARTITION BY date ORDER BY relevance_score DESC) AS rank
    FROM news
) ranked
WHERE rank <= 5
GROUP BY date;

SET maintenance_work_mem = '512MB';
CREATE INDEX news_embedding_idx ON news USING hnsw (embedding vector_cosine_ops);

ANALYZE news;
