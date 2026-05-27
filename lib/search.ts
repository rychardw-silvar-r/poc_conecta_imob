import Groq from 'groq-sdk'
import { supabaseAdmin } from './supabase/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export type SearchFilters = {
  categoria?: 'aluguel' | 'venda' | 'investimento' | 'construcao' | null
  tipo_imovel?: string | null
  bairro?: string | null
  cidade?: string | null
  status?:
    | 'novo'
    | 'em_atendimento'
    | 'qualificado'
    | 'fechado'
    | 'perdido'
    | null
  quartos_min?: number | null
  texto_livre?: string | null
}

export type AssistantOutput =
  | { kind: 'search'; filters: SearchFilters }
  | { kind: 'text'; text: string }

const SYSTEM_PROMPT = `Você é um assistente de WhatsApp da plataforma Conecta Imob (mercado imobiliário). Ajuda captadores e comerciais a consultar leads salvos no sistema.

Tipos de mensagem que recebe:
- BUSCA: "Tem alguém procurando AP?", "Quem quer comprar casa em Pinheiros?", "Leads novos de investimento", "Quem está olhando terreno?" → use a ferramenta search_leads
- CONVERSA: saudações, agradecimentos, dúvida sobre o que pode perguntar → responda em texto curto, sem usar ferramenta

Categorias possíveis (interprete pela intenção do cliente final, não do captador):
- aluguel: cliente final quer ALUGAR
- venda: cliente final quer COMPRAR para morar
- investimento: cliente final quer COMPRAR para render (locação, valorização)
- construcao: cliente final quer construir, reformar, terreno

Tipos de imóvel: normalize para a forma completa.
- "AP", "apto", "apartamento" → apartamento
- "casa"
- "terreno"
- "sala comercial", "comercial" → sala comercial

Status: por padrão NÃO filtre por status (o backend já exclui fechados/perdidos automaticamente). Só preencha status se o usuário pedir explicitamente ("leads fechados", "novos clientes").

Seja conciso. Responda sempre em português.`

const SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'search_leads',
    description:
      'Busca leads salvos que correspondem aos critérios extraídos da pergunta do usuário',
    parameters: {
      type: 'object',
      properties: {
        categoria: {
          type: ['string', 'null'],
          enum: [
            'aluguel',
            'venda',
            'investimento',
            'construcao',
            null
          ]
        },
        tipo_imovel: {
          type: ['string', 'null'],
          description: 'apartamento, casa, terreno, sala comercial, etc.'
        },
        bairro: { type: ['string', 'null'] },
        cidade: { type: ['string', 'null'] },
        status: {
          type: ['string', 'null'],
          enum: [
            'novo',
            'em_atendimento',
            'qualificado',
            'fechado',
            'perdido',
            null
          ]
        },
        quartos_min: {
          type: ['number', 'null'],
          description: 'Quartos mínimos. Para "2 quartos" use 2.'
        },
        texto_livre: {
          type: ['string', 'null'],
          description:
            'Termo livre quando os filtros estruturados não cobrem (nome próprio, palavra-chave que apareceria na descrição)'
        }
      }
    }
  }
}

export async function interpretarMensagem(
  mensagem: string
): Promise<AssistantOutput> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: mensagem }
    ],
    tools: [SEARCH_TOOL],
    tool_choice: 'auto'
  })

  const choice = response.choices[0]?.message
  if (!choice) {
    return { kind: 'text', text: 'Não entendi. Pode reformular?' }
  }

  if (choice.tool_calls && choice.tool_calls.length > 0) {
    const args = JSON.parse(
      choice.tool_calls[0].function.arguments
    ) as SearchFilters
    return { kind: 'search', filters: args }
  }

  return {
    kind: 'text',
    text: choice.content ?? 'Olá! Pergunte algo como "quem está procurando apartamento?"'
  }
}

type LeadResult = {
  id: string
  created_at: string
  nome_cliente: string | null
  telefone_cliente: string | null
  categoria: string | null
  descricao: string | null
  caracteristicas: Record<string, unknown>
  status: string
  captador?: { nome: string } | null
  comercial?: { nome: string } | null
}

export async function searchLeads(
  filters: SearchFilters
): Promise<LeadResult[]> {
  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('leads')
    .select(
      'id, created_at, nome_cliente, telefone_cliente, categoria, descricao, caracteristicas, status, captador:captador_id(nome), comercial:comercial_id(nome)'
    )
    .order('created_at', { ascending: false })

  let results = (data ?? []) as unknown as LeadResult[]

  if (filters.categoria) {
    results = results.filter((l) => l.categoria === filters.categoria)
  }

  if (filters.status) {
    results = results.filter((l) => l.status === filters.status)
  } else {
    results = results.filter(
      (l) =>
        l.status === 'novo' ||
        l.status === 'em_atendimento' ||
        l.status === 'qualificado'
    )
  }

  if (filters.tipo_imovel) {
    const tipo = filters.tipo_imovel.toLowerCase()
    results = results.filter((l) => {
      const t = (l.caracteristicas as { tipo_imovel?: unknown })?.tipo_imovel
      return typeof t === 'string' && t.toLowerCase().includes(tipo)
    })
  }

  if (filters.bairro) {
    const bairro = filters.bairro.toLowerCase()
    results = results.filter((l) => {
      const b = (l.caracteristicas as { bairro?: unknown })?.bairro
      return typeof b === 'string' && b.toLowerCase().includes(bairro)
    })
  }

  if (filters.cidade) {
    const cidade = filters.cidade.toLowerCase()
    results = results.filter((l) => {
      const c = (l.caracteristicas as { cidade?: unknown })?.cidade
      return typeof c === 'string' && c.toLowerCase().includes(cidade)
    })
  }

  if (
    filters.quartos_min !== null &&
    filters.quartos_min !== undefined
  ) {
    const min = filters.quartos_min
    results = results.filter((l) => {
      const q = (l.caracteristicas as { quartos?: unknown })?.quartos
      return typeof q === 'number' && q >= min
    })
  }

  if (filters.texto_livre) {
    const q = filters.texto_livre.toLowerCase()
    results = results.filter(
      (l) =>
        l.descricao?.toLowerCase().includes(q) ||
        l.nome_cliente?.toLowerCase().includes(q)
    )
  }

  return results.slice(0, 10)
}

export function formatSearchResults(leads: LeadResult[]): string {
  if (leads.length === 0) {
    return 'Nenhum lead encontrado com esses critérios.'
  }

  const linhas: string[] = [`Encontrei ${leads.length} lead(s):`, '']

  leads.forEach((lead, idx) => {
    const c = (lead.caracteristicas ?? {}) as Record<string, unknown>
    const nome = lead.nome_cliente ?? 'Cliente sem nome'
    const cat = lead.categoria ? ` (${lead.categoria})` : ''
    linhas.push(`*${idx + 1}. ${nome}*${cat}`)

    if (lead.descricao) {
      linhas.push(`   ${lead.descricao}`)
    }

    const detalhes: string[] = []
    if (c.tipo_imovel) detalhes.push(String(c.tipo_imovel))
    if (c.quartos) detalhes.push(`${c.quartos} quartos`)
    if (c.bairro) detalhes.push(String(c.bairro))
    if (c.faixa_preco) detalhes.push(String(c.faixa_preco))
    if (detalhes.length > 0) {
      linhas.push(`   ${detalhes.join(' · ')}`)
    }

    if (lead.telefone_cliente) {
      linhas.push(`   Tel: ${lead.telefone_cliente}`)
    }
    if (lead.comercial?.nome) {
      linhas.push(`   Comercial: ${lead.comercial.nome}`)
    }

    linhas.push('')
  })

  return linhas.join('\n').trim()
}
