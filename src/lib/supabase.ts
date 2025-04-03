import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASEURL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASEANON_KEY;

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper function to check if Supabase connection is available
export const checkSupabaseConnection = async (): Promise<boolean> => {
  const { data, error } = await supabase.from("news").select("*").limit(1);
  if (error) {
    console.error("Supabase connection error:", error);
    return false;
  } else {
    console.log("Supabase is connected:", data);
    return true;
  }
};
