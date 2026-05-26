import { redirect } from 'next/navigation'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server'
import { LeadsBoard } from './leads-board'
import type { Lead } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
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
    redirect(
      '/login?error=' + encodeURIComponent('Acesso restrito a comerciais.')
    )
  }

  const { data: leads } = await admin
    .from('leads')
    .select(
      'id, created_at, captador_id, comercial_id, audio_url, transcricao, categoria, nome_cliente, telefone_cliente, descricao, caracteristicas, status, confirmado_captador, captador:captador_id(nome), comercial:comercial_id(nome)'
    )
    .order('created_at', { ascending: false })

  return (
    <LeadsBoard
      leads={(leads ?? []) as unknown as Lead[]}
      usuarioAtual={{ id: usuario.id, nome: usuario.nome }}
    />
  )
}
