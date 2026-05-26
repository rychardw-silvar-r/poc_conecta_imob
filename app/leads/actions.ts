'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server'
import type { StatusLead } from '@/lib/types'

async function autorizarComercial() {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/login')

  const admin = supabaseAdmin()
  const { data: usuario } = await admin
    .from('usuarios')
    .select('id, papel')
    .eq('email', user.email)
    .maybeSingle()
  if (
    !usuario ||
    (usuario.papel !== 'comercial' && usuario.papel !== 'admin')
  ) {
    redirect('/login')
  }
  return { id: usuario.id as string, admin }
}

export async function assumirLead(leadId: string) {
  const { id, admin } = await autorizarComercial()
  await admin
    .from('leads')
    .update({ comercial_id: id, status: 'em_atendimento' })
    .eq('id', leadId)
  revalidatePath('/leads')
}

export async function mudarStatus(leadId: string, status: StatusLead) {
  const { admin } = await autorizarComercial()
  await admin.from('leads').update({ status }).eq('id', leadId)
  revalidatePath('/leads')
}
