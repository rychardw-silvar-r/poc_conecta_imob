'use client'

import { useState, useTransition } from 'react'
import { signOut } from '../login/actions'
import { addUser, updateUser, toggleAtivo, deleteUser } from './actions'

type Papel = 'captador' | 'comercial' | 'admin'

type User = {
  id: string
  nome: string
  papel: Papel
  telefone: string | null
  email: string | null
  ativo: boolean
  created_at: string
}

type LeadRow = {
  id: string
  status: 'novo' | 'em_atendimento' | 'qualificado' | 'fechado' | 'perdido'
  captador_id: string | null
  comercial_id: string | null
}

export function AdminView({
  usuarioAtual,
  users,
  leads
}: {
  usuarioAtual: { id: string; nome: string }
  users: User[]
  leads: LeadRow[]
}) {
  const [tab, setTab] = useState<'usuarios' | 'resumo'>('usuarios')

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administração</h1>
          <p className="text-sm text-zinc-500">Olá, {usuarioAtual.nome}.</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a href="/leads" className="text-zinc-700 hover:text-zinc-900">
            Leads
          </a>
          <form action={signOut}>
            <button className="text-zinc-600 underline hover:text-zinc-900">
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('usuarios')}
          className={tabClass(tab === 'usuarios')}
        >
          Usuários ({users.length})
        </button>
        <button
          onClick={() => setTab('resumo')}
          className={tabClass(tab === 'resumo')}
        >
          Resumo
        </button>
      </div>

      {tab === 'usuarios' && (
        <UsersPanel users={users} currentUserId={usuarioAtual.id} />
      )}
      {tab === 'resumo' && <ResumoPanel users={users} leads={leads} />}
    </div>
  )
}

function tabClass(active: boolean) {
  return (
    'rounded-full px-3 py-1 text-sm transition ' +
    (active
      ? 'bg-zinc-900 text-white'
      : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100')
  )
}

function UsersPanel({
  users,
  currentUserId
}: {
  users: User[]
  currentUserId: string
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Usuários</h2>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          {showAdd ? 'Cancelar' : 'Adicionar usuário'}
        </button>
      </div>

      {showAdd && (
        <UserForm action={addUser} onDone={() => setShowAdd(false)} />
      )}

      <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
        {users.length === 0 ? (
          <li className="p-6 text-center text-sm text-zinc-500">
            Nenhum usuário cadastrado.
          </li>
        ) : (
          users.map((u) =>
            editingId === u.id ? (
              <li key={u.id} className="p-4">
                <UserForm
                  user={u}
                  action={updateUser}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <UserRow
                key={u.id}
                user={u}
                currentUserId={currentUserId}
                onEdit={() => setEditingId(u.id)}
              />
            )
          )
        )}
      </ul>
    </div>
  )
}

function UserRow({
  user,
  currentUserId,
  onEdit
}: {
  user: User
  currentUserId: string
  onEdit: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const isSelf = user.id === currentUserId

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-[220px] flex-1">
        <div className="flex items-center gap-2 font-medium">
          {user.nome}
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {user.papel}
          </span>
          {!user.ativo && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              inativo
            </span>
          )}
          {isSelf && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              você
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {user.telefone ?? '—'}
          {user.email ? ` · ${user.email}` : ''}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="rounded-lg border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
      >
        Editar
      </button>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await toggleAtivo(user.id, !user.ativo)
          })
        }
        className="rounded-lg border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        {user.ativo ? 'Desativar' : 'Reativar'}
      </button>
      {!isSelf && (
        <button
          disabled={isPending}
          onClick={() => {
            if (
              !confirm(
                `Excluir ${user.nome}? Esta ação é permanente. Leads associados ficarão sem captador/comercial atribuído.`
              )
            ) {
              return
            }
            startTransition(async () => {
              try {
                await deleteUser(user.id)
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Erro ao excluir')
              }
            })
          }}
          className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Excluir
        </button>
      )}
    </li>
  )
}

function UserForm({
  user,
  action,
  onDone
}: {
  user?: User
  action: (formData: FormData) => Promise<void>
  onDone: () => void
}) {
  const [papel, setPapel] = useState<Papel>(user?.papel ?? 'captador')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      action={(formData) => {
        setError(null)
        startTransition(async () => {
          try {
            await action(formData)
            onDone()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao salvar')
          }
        })
      }}
      className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4"
    >
      {user && <input type="hidden" name="id" value={user.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Nome
          <input
            type="text"
            name="nome"
            required
            defaultValue={user?.nome ?? ''}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
          />
        </label>
        <label className="text-sm">
          Papel
          <select
            name="papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
          >
            <option value="captador">Captador</option>
            <option value="comercial">Comercial</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {papel === 'captador' && (
          <label className="text-sm">
            Telefone (E.164)
            <input
              type="text"
              name="telefone"
              required
              placeholder="+5511987654321"
              defaultValue={user?.telefone ?? ''}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
            />
          </label>
        )}
        {(papel === 'comercial' || papel === 'admin') && (
          <label className="text-sm">
            Email
            <input
              type="email"
              name="email"
              required
              placeholder="usuario@email.com"
              defaultValue={user?.email ?? ''}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
            />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {user ? 'Salvar' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function ResumoPanel({ users, leads }: { users: User[]; leads: LeadRow[] }) {
  const total = leads.length
  const novos = leads.filter((l) => l.status === 'novo').length
  const emAtendimento = leads.filter((l) => l.status === 'em_atendimento').length
  const qualificados = leads.filter((l) => l.status === 'qualificado').length
  const fechados = leads.filter((l) => l.status === 'fechado').length
  const perdidos = leads.filter((l) => l.status === 'perdido').length

  const captadores = users.filter((u) => u.papel === 'captador' && u.ativo)
  const comerciais = users.filter(
    (u) => (u.papel === 'comercial' || u.papel === 'admin') && u.ativo
  )

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-medium">Pipeline</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={total} />
          <StatCard label="Novos" value={novos} accent="blue" />
          <StatCard label="Em atendimento" value={emAtendimento} accent="amber" />
          <StatCard label="Qualificados" value={qualificados} accent="purple" />
          <StatCard label="Fechados" value={fechados} accent="green" />
          <StatCard label="Perdidos" value={perdidos} accent="zinc" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Por captador</h2>
        <UserBreakdown
          users={captadores}
          countFor={(uid) =>
            leads.filter((l) => l.captador_id === uid).length
          }
          fechadosFor={(uid) =>
            leads.filter(
              (l) => l.captador_id === uid && l.status === 'fechado'
            ).length
          }
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Por comercial</h2>
        <UserBreakdown
          users={comerciais}
          countFor={(uid) =>
            leads.filter((l) => l.comercial_id === uid).length
          }
          fechadosFor={(uid) =>
            leads.filter(
              (l) => l.comercial_id === uid && l.status === 'fechado'
            ).length
          }
        />
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent = 'zinc'
}: {
  label: string
  value: number
  accent?: 'zinc' | 'blue' | 'amber' | 'purple' | 'green'
}) {
  const colors: Record<string, string> = {
    zinc: 'text-zinc-900',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
    green: 'text-green-700'
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={'mt-1 text-2xl font-semibold ' + colors[accent]}>
        {value}
      </div>
    </div>
  )
}

function UserBreakdown({
  users,
  countFor,
  fechadosFor
}: {
  users: User[]
  countFor: (userId: string) => number
  fechadosFor: (userId: string) => number
}) {
  if (users.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        Nenhum usuário ativo nesse papel.
      </p>
    )
  }
  return (
    <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
      {users.map((u) => {
        const total = countFor(u.id)
        const fechados = fechadosFor(u.id)
        return (
          <li
            key={u.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <div className="font-medium">{u.nome}</div>
              <div className="text-xs text-zinc-500">
                {total} leads · {fechados} fechados
              </div>
            </div>
            <div className="text-sm text-zinc-600">
              {total > 0
                ? `${Math.round((fechados / total) * 100)}% conversão`
                : '—'}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
