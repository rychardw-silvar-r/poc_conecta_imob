'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server'
import type { StatusLead, Interacao } from '@/lib/types'

async function autorizarComercial() {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user || !user.email) redirect('/login')

  const admin = supabaseAdmin()
  const { data: usuario } = await admin
    .from('usuarios')
    .select('id, nome, papel')
    .eq('email', user.email)
    .maybeSingle()
  if (
    !usuario ||
    (usuario.papel !== 'comercial' && usuario.papel !== 'admin')
  ) {
    redirect('/login')
  }
  return {
    id: usuario.id as string,
    nome: usuario.nome as string,
    admin
  }
}

export async function assumirLead(leadId: string) {
  const { id, nome, admin } = await autorizarComercial()

  await admin
    .from('leads')
    .update({ comercial_id: id, status: 'em_atendimento' })
    .eq('id', leadId)

  await admin.from('interacoes').insert({
    lead_id: leadId,
    autor_id: id,
    tipo: 'atribuicao',
    conteudo: `${nome} assumiu o lead`
  })

  revalidatePath('/leads')
}

export async function mudarStatus(leadId: string, status: StatusLead) {
  const { id, nome, admin } = await autorizarComercial()

  const { data: lead } = await admin
    .from('leads')
    .select('status')
    .eq('id', leadId)
    .maybeSingle()
  if (!lead) return

  await admin.from('leads').update({ status }).eq('id', leadId)

  if (lead.status !== status) {
    await admin.from('interacoes').insert({
      lead_id: leadId,
      autor_id: id,
      tipo: 'mudanca_status',
      conteudo: `${nome} alterou status: ${lead.status} → ${status}`
    })
  }

  revalidatePath('/leads')
}

export async function addNota(leadId: string, conteudo: string) {
  const { id, admin } = await autorizarComercial()
  const texto = conteudo.trim()
  if (!texto) return

  await admin.from('interacoes').insert({
    lead_id: leadId,
    autor_id: id,
    tipo: 'nota',
    conteudo: texto
  })

  revalidatePath('/leads')
}

export async function getInteracoes(leadId: string): Promise<Interacao[]> {
  const { admin } = await autorizarComercial()
  const { data } = await admin
    .from('interacoes')
    .select('id, tipo, conteudo, created_at, autor:autor_id(nome)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  return (data ?? []) as unknown as Interacao[]
}
