'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Interacao, Lead, StatusLead } from '@/lib/types'
import {
  assumirLead,
  mudarStatus,
  addNota,
  getInteracoes,
  deleteLead
} from './actions'
import { signOut } from '../login/actions'
import { supabaseBrowser } from '@/lib/supabase/client'

const STATUS_TABS: { key: 'todos' | StatusLead; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'novo', label: 'Novos' },
  { key: 'em_atendimento', label: 'Em atendimento' },
  { key: 'qualificado', label: 'Qualificados' },
  { key: 'fechado', label: 'Fechados' },
  { key: 'perdido', label: 'Perdidos' }
]

const STATUS_LABEL: Record<StatusLead, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  qualificado: 'Qualificado',
  fechado: 'Fechado',
  perdido: 'Perdido'
}

export function LeadsBoard({
  leads,
  usuarioAtual,
  isAdmin
}: {
  leads: Lead[]
  usuarioAtual: { id: string; nome: string }
  isAdmin: boolean
}) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusLead>(
    'todos'
  )
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()
    console.log('[realtime] inicializando subscription leads')

    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        console.log('[realtime] aplicando access_token na realtime')
        supabase.realtime.setAuth(session.access_token)
      } else {
        console.warn('[realtime] sem sessão — RLS vai bloquear eventos')
      }

      channel = supabase
        .channel('leads-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leads' },
          (payload) => {
            console.log('[realtime] evento leads:', payload)
            router.refresh()
          }
        )
        .subscribe((status, err) => {
          console.log('[realtime] status:', status, err ?? '')
        })
    })()

    return () => {
      console.log('[realtime] removendo subscription')
      if (channel) supabase.removeChannel(channel)
    }
  }, [router])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter((l) => {
      if (statusFilter !== 'todos' && l.status !== statusFilter) return false
      if (!q) return true
      const c = (l.caracteristicas ?? {}) as Record<string, unknown>
      const haystack = [
        l.nome_cliente,
        l.descricao,
        l.transcricao,
        l.telefone_cliente,
        c.bairro,
        c.cidade,
        c.tipo_imovel
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [leads, statusFilter, search])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-zinc-500">Olá, {usuarioAtual.nome}.</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {isAdmin && (
            <a href="/admin" className="text-zinc-700 hover:text-zinc-900">
              Admin
            </a>
          )}
          <form action={signOut}>
            <button className="text-zinc-600 underline hover:text-zinc-900">
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={
              'rounded-full px-3 py-1 text-sm transition ' +
              (statusFilter === tab.key
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100')
            }
          >
            {tab.label}
          </button>
        ))}
        <input
          type="search"
          placeholder="Buscar por cliente, bairro, telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-72 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-900"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhum lead encontrado.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              open={openId === lead.id}
              onToggle={() =>
                setOpenId(openId === lead.id ? null : lead.id)
              }
              usuarioAtual={usuarioAtual}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function LeadRow({
  lead,
  open,
  onToggle,
  usuarioAtual
}: {
  lead: Lead
  open: boolean
  onToggle: () => void
  usuarioAtual: { id: string; nome: string }
}) {
  const [isPending, startTransition] = useTransition()
  const caract = (lead.caracteristicas ?? {}) as Record<string, unknown>
  const bairro = typeof caract.bairro === 'string' ? caract.bairro : null
  const faixaPreco =
    typeof caract.faixa_preco === 'string' ? caract.faixa_preco : null

  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-zinc-50"
      >
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {lead.nome_cliente ?? 'Cliente sem nome'}
            </span>
            {lead.categoria && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                {lead.categoria}
              </span>
            )}
            <span
              className={
                'rounded-full px-2 py-0.5 text-xs ' + statusColor(lead.status)
              }
            >
              {STATUS_LABEL[lead.status]}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
            {lead.descricao ?? lead.transcricao ?? '—'}
          </p>
          <div className="mt-1 text-xs text-zinc-500">
            {formatDate(lead.created_at)}
            {bairro ? ` · ${bairro}` : ''}
            {faixaPreco ? ` · ${faixaPreco}` : ''}
            {lead.captador?.nome ? ` · Captador: ${lead.captador.nome}` : ''}
          </div>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-zinc-200 px-5 py-4">
          {lead.telefone_cliente && (
            <div className="text-sm">
              Telefone:{' '}
              <a
                href={`https://wa.me/${onlyDigits(lead.telefone_cliente)}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline"
              >
                {lead.telefone_cliente}
              </a>
            </div>
          )}

          <CaracteristicasGrid caracteristicas={caract} />

          {lead.transcricao && (
            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-600">
                Ver transcrição
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-zinc-800">
                {lead.transcricao}
              </p>
            </details>
          )}

          {lead.audio_url && (
            <audio controls src={lead.audio_url} className="w-full" />
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {lead.comercial_id !== usuarioAtual.id && (
              <button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await assumirLead(lead.id)
                  })
                }
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
              >
                Assumir lead
              </button>
            )}
            <select
              defaultValue={lead.status}
              disabled={isPending}
              onChange={(e) => {
                const next = e.target.value as StatusLead
                startTransition(async () => {
                  await mudarStatus(lead.id, next)
                })
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              <option value="novo">Novo</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="qualificado">Qualificado</option>
              <option value="fechado">Fechado</option>
              <option value="perdido">Perdido</option>
            </select>
            {lead.comercial?.nome && (
              <span className="ml-auto text-xs text-zinc-500">
                Atribuído a {lead.comercial.nome}
              </span>
            )}
            <button
              disabled={isPending}
              onClick={() => {
                if (
                  !confirm(
                    `Excluir o lead de ${lead.nome_cliente ?? 'cliente sem nome'}? Esta ação é permanente e remove o histórico de interações também.`
                  )
                ) {
                  return
                }
                startTransition(async () => {
                  await deleteLead(lead.id)
                })
              }}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Excluir
            </button>
          </div>

          <InteracoesSection leadId={lead.id} />
        </div>
      )}
    </li>
  )
}

function InteracoesSection({ leadId }: { leadId: string }) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [loading, setLoading] = useState(true)
  const [nota, setNota] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getInteracoes(leadId).then((data) => {
      if (!cancelled) {
        setInteracoes(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [leadId])

  function handleSubmit() {
    const text = nota.trim()
    if (!text) return
    startTransition(async () => {
      await addNota(leadId, text)
      setNota('')
      const fresh = await getInteracoes(leadId)
      setInteracoes(fresh)
    })
  }

  return (
    <section className="border-t border-zinc-200 pt-4">
      <h3 className="mb-2 text-sm font-medium text-zinc-700">Histórico</h3>
      {loading ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : interacoes.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma interação ainda.</p>
      ) : (
        <ul className="space-y-2">
          {interacoes.map((i) => (
            <li key={i.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <div className="text-xs text-zinc-500">
                {i.autor?.nome ?? 'Sistema'} · {formatDate(i.created_at)}
                {i.tipo !== 'nota' && (
                  <span className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700">
                    {i.tipo === 'mudanca_status' ? 'status' : i.tipo}
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                {i.conteudo}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Adicionar nota..."
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !nota.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Adicionar nota
          </button>
        </div>
      </div>
    </section>
  )
}

function CaracteristicasGrid({
  caracteristicas
}: {
  caracteristicas: Record<string, unknown>
}) {
  const labels: [string, string][] = [
    ['tipo_imovel', 'Tipo de imóvel'],
    ['quartos', 'Quartos'],
    ['bairro', 'Bairro'],
    ['cidade', 'Cidade'],
    ['faixa_preco', 'Faixa de preço'],
    ['urgencia', 'Urgência'],
    ['observacoes', 'Observações']
  ]
  const items = labels
    .map(([k, label]) => [label, caracteristicas[k]] as const)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')

  if (items.length === 0) return null
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {items.map(([label, v]) => (
        <div key={label} className="flex">
          <dt className="w-32 text-zinc-500">{label}:</dt>
          <dd className="flex-1 text-zinc-800">{String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

function statusColor(s: StatusLead): string {
  switch (s) {
    case 'novo':
      return 'bg-blue-100 text-blue-800'
    case 'em_atendimento':
      return 'bg-amber-100 text-amber-800'
    case 'qualificado':
      return 'bg-purple-100 text-purple-800'
    case 'fechado':
      return 'bg-green-100 text-green-800'
    case 'perdido':
      return 'bg-zinc-200 text-zinc-700'
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}
