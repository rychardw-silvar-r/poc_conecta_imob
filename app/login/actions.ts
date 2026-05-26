'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Informe um email válido.'))
  }

  const supabase = await supabaseServer()
  const headerList = await headers()
  const host = headerList.get('host') ?? 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`
    }
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }
  redirect('/login?sent=1')
}

export async function signOut() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}
