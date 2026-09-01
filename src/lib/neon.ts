import { neon } from "@neondatabase/serverless";

const neonUrl = import.meta.env.VITE_NEON_NEWS_URL;

// Read-only connection scoped to the `news` table (role: news_readonly).
export const sql = neon(neonUrl);

export const checkNeonConnection = async (): Promise<boolean> => {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Neon connection error:", error);
    return false;
  }
};
