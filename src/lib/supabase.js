import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://ygpvdkkmlyasocanvtfl.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncHZka2ttbHlhc29jYW52dGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzY0NTksImV4cCI6MjA4OTYxMjQ1OX0.Ozwt_DYrrxdljCcowhbIUaux4hal0wVoM2wft_kguUk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
