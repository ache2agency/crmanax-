import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ylbynshlpjwynnekvrku.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYnluc2hscGp3eW5uZWt2cmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzE3MzMsImV4cCI6MjA4ODY0NzczM30.LmCJ5xXD7mMzqIGq6x4Z-xjHGVCJEiXPBYP7X19snAA'

export const supabase = createClient(supabaseUrl, supabaseKey)