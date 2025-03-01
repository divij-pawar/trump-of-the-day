import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ;

console.log(supabaseUrl)
console.log(supabaseAnonKey)

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper function to check if Supabase connection is available
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    // First, check if we can connect to Supabase at all
    const { error: pingError } = await supabase.from('_dummy_query_for_connection_test').select('*').limit(1).single();
    
    // If we get a "relation does not exist" error, that's actually good - it means we connected to Supabase
    // but the table doesn't exist (which is expected for our dummy query)
    if (pingError && pingError.code === '42P01') {
      return true;
    }
    
    // If we get any other error, try checking for our actual table
    const { error } = await supabase.from('updates').select('count', { count: 'exact', head: true });
    
    // If we get a "relation does not exist" error for our actual table, we need to create it
    if (error && error.code === '42P01') {
      console.warn('The "updates" table does not exist in the Supabase database.');
      return false;
    }
    
    return !error;
  } catch (err) {
    console.error('Supabase connection check failed:', err);
    return false;
  }
};