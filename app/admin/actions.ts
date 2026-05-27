'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server'
import type { Papel } from '@/lib/types'

async function autorizarAdmin() {
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
  if (!usuario || usuario.papel !== 'admin') redirect('/leads')
  return { id: usuario.id as string, admin }
}

function parseUserForm(formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  const papel = String(formData.get('papel') ?? '') as Papel
  const telefone = String(formData.get('telefone') ?? '').trim() || null
  const email =
    String(formData.get('email') ?? '').trim().toLowerCase() || null

  if (!nome) throw new Error('Nome é obrigatório')
  if (!papel || !['captador', 'comercial', 'admin'].includes(papel)) {
    throw new Error('Papel inválido')
  }
  if (papel === 'captador' && !telefone) {
    throw new Error('Captadores precisam de telefone')
  }
  if (papel === 'captador' && telefone && !telefone.startsWith('+')) {
    throw new Error('Telefone deve estar no formato E.164 (ex: +5511987654321)')
  }
  if ((papel === 'comercial' || papel === 'admin') && !email) {
    throw new Error('Comerciais e admins precisam de email')
  }
  return { nome, papel, telefone, email }
}

export async function addUser(formData: FormData) {
  const { admin } = await autorizarAdmin()
  const { nome, papel, telefone, email } = parseUserForm(formData)

  const { error } = await admin.from('usuarios').insert({
    nome,
    papel,
    telefone,
    email,
    ativo: true
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function updateUser(formData: FormData) {
  const { admin } = await autorizarAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) throw new Error('ID ausente')
  const { nome, papel, telefone, email } = parseUserForm(formData)

  const { error } = await admin
    .from('usuarios')
    .update({ nome, papel, telefone, email })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}

export async function toggleAtivo(userId: string, ativo: boolean) {
  const { admin } = await autorizarAdmin()
  await admin.from('usuarios').update({ ativo }).eq('id', userId)
  revalidatePath('/admin')
}

export async function deleteUser(userId: string) {
  const { id: currentId, admin } = await autorizarAdmin()
  if (userId === currentId) {
    throw new Error('Você não pode excluir sua própria conta')
  }
  const { error } = await admin.from('usuarios').delete().eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
}
