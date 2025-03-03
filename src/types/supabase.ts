export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      updates: {
        Row: {
          id: number;
          title: string;
          content: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          title: string;
          content: string;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          title?: string;
          content?: string;
          date?: string;
          created_at?: string;
        };
      };
    };
  };
}
