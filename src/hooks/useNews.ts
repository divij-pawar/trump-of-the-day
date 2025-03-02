// useNews.ts
import { useState, useEffect } from 'react';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { format } from 'date-fns';

export interface NewsItem {
  id: number;
  date: string;
  link: string;
  description:string;
  title:string;
  news_source:string;
  image_url:string;
}

export const useNews = (selectedDate: Date) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      setIsUsingMockData(false);

      try {
        // Check if Supabase is available
        const isConnected = await checkSupabaseConnection();

        if (!isConnected) {
          console.log('Using mock data due to Supabase connection issues');
          setIsUsingMockData(true);
          setNews(getMockNews(selectedDate));
          return;
        }

        // Format the selected date to match our database format (YYYY-MM-DD)
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        console.log(formattedDate)
        // Fetch all news items matching the selected date
        const { data, error } = await supabase
          .from('news')
          .select('*')
          .eq('date', formattedDate);

        if (error) {
          if (error.code === '42P01') {
            throw new Error('The news table does not exist in the database. Please run the migration script.');
          } else {
            throw error;
          }
        }
        if (data && data.length > 0) {
          setNews(data);
        } else {
          console.log("Using mock data, useNews.ts:54");
          setIsUsingMockData(true);
          setNews(getMockNews(selectedDate));
        }
      } catch (err: any) {
        console.error('Error fetching news:', err);

        if (err.message && err.message.includes('news table does not exist')) {
          setError('Database table not found. Please run the migration script or connect to Supabase.');
        } else {
          setError('Using mock data due to database connection issues.');
        }

        setIsUsingMockData(true);
        setNews(getMockNews(selectedDate));
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [selectedDate]);

  return { news, loading, error, isUsingMockData };
};

// Mock data function for fallback
const getMockNews = (date: Date): NewsItem[] => {
  const formattedDate = format(date, 'yyyy-MM-dd');

  return [
    {
      id: 1,
      date: formattedDate,
      link: 'https://example.com/news1',
    },
    {
      id: 2,
      date: formattedDate,
      link: 'https://example.com/news2',
    },
  ];
};