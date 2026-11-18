-- Local-only stand-in for the Neon read-only role (see db/schema.sql in the
-- pipeline repo). Runs before the schema so its GRANTs find the role.
CREATE ROLE news_readonly WITH LOGIN PASSWORD 'readonly';
