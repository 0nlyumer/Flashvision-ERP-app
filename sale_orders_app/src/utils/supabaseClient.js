import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zefeylnjghbdeivdsppc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZmV5bG5qZ2hiZGVpdmRzcHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NTgwMjcsImV4cCI6MjEwODEzNDAyN30.L5fcmV1yrsCZ4-daErc_E0LAnaBcQXnDacl7tKdOl5c";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
