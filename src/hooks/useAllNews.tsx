// useAllNews.tsx
import { useState, useEffect } from "react";
import { sql, checkNeonConnection } from "../lib/neon";
import { format } from "date-fns";

export interface NewsItem {
  id: number;
  date: string;
  link: string;
  description: string;
  title: string;
  news_source: string;
  image_url: string;
}

export const useAllNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noNewArticles, setNoNewArticles] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      setNoNewArticles(false);

      try {
        const isConnected = await checkNeonConnection();

        if (!isConnected) {
          setNoNewArticles(true);
          setNews([]);
          return;
        }

        const data = (await sql`SELECT id, date::text as date, title, description, link, news_source, image_url FROM news`) as NewsItem[];

        if (data && data.length > 0) {
          setNews(data);
        } else {
          console.log("No news, useNews.ts:54");
          setNoNewArticles(true);
          setNews([]);
        }
      } catch (err: any) {
        console.error("Error fetching news:", err);
        setError("No news due to database connection issues.");
        setNoNewArticles(true);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  },[]);

  return { news, loading, error, noNewArticles };
};

// NoNews fallback UI component
export const DisplayNoNews = ({ date }: { date: Date }) => {
  return (
    <div className="text-center text-gray-700 dark:text-gray-300">
      <h1 className="text-xl font-bold text-center text-gray-800 dark:text-white">
        No news found for {format(date, "MMMM d, yyyy")}. . . . . . . . . yet
      </h1>
    </div>
  );
};
