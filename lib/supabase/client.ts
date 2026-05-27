import { createBrowserClient } from '@supabase/ssr'

// Cliente para uso em client components (subscribe realtime, etc).
// Usa anon key + sessao via cookie, sujeito a RLS.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
