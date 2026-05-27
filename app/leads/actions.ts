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

export async function deleteLead(leadId: string) {
  const { admin } = await autorizarComercial()

  // Recupera o audio_url antes do delete pra limpar o storage depois
  const { data: lead } = await admin
    .from('leads')
    .select('audio_url')
    .eq('id', leadId)
    .maybeSingle()

  // Lead-first: se o storage falhar depois, o lead ainda some.
  // Interacoes vao junto via cascade da FK.
  const { error } = await admin.from('leads').delete().eq('id', leadId)
  if (error) throw new Error(error.message)

  // Best-effort: remove o audio do Storage. Se falhar (ja removido,
  // path nao bate, etc), apenas loga e segue.
  if (lead?.audio_url) {
    const path = extrairPathDoAudio(lead.audio_url)
    if (path) {
      const { error: storageErr } = await admin.storage
        .from('audios-captacao')
        .remove([path])
      if (storageErr) {
        console.warn('[deleteLead] storage remove falhou', storageErr.message)
      }
    }
  }

  revalidatePath('/leads')
}

function extrairPathDoAudio(url: string): string | null {
  const match = url.match(/\/audios-captacao\/(.+)$/)
  return match ? match[1] : null
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
