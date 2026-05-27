import { redirect } from 'next/navigation'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server'
import { AdminView } from './admin-view'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
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

  if (!usuario || usuario.papel !== 'admin') {
    redirect('/leads')
  }

  const { data: users } = await admin
    .from('usuarios')
    .select('id, nome, papel, telefone, email, ativo, created_at')
    .order('created_at', { ascending: true })

  const { data: leads } = await admin
    .from('leads')
    .select('id, status, captador_id, comercial_id, created_at')

  return (
    <AdminView
      usuarioAtual={{ id: usuario.id, nome: usuario.nome }}
      users={users ?? []}
      leads={leads ?? []}
    />
  )
}
