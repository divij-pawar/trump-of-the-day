// useNews.ts
import { useState, useEffect } from "react";
import { supabase, checkSupabaseConnection } from "../lib/supabase";
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

export const useNews = (selectedDate: Date) => {
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
        const isConnected = await checkSupabaseConnection();

        if (!isConnected) {
          setNoNewArticles(true);
          setNews([]);
          return;
        }

        const formattedDate = format(selectedDate, "yyyy-MM-dd");
        console.log(formattedDate);

        const { data, error } = await supabase
          .from("news")
          .select("*")
          .eq("date", formattedDate);

        if (error) {
          if (error.code === "42P01") {
            throw new Error(
              "The news table does not exist in the database. Please run the migration script."
            );
          } else {
            throw error;
          }
        }

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
  }, [selectedDate]);

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
