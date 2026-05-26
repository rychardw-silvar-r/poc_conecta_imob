import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export type Categoria = 'aluguel' | 'venda' | 'investimento' | 'construcao'
export type Urgencia = 'baixa' | 'media' | 'alta'

export type LeadExtraido = {
  categoria: Categoria | null
  nome_cliente: string | null
  telefone_cliente: string | null
  descricao: string
  caracteristicas: {
    tipo_imovel?: string
    quartos?: number
    bairro?: string
    cidade?: string
    faixa_preco?: string
    urgencia?: Urgencia
    observacoes?: string
  }
}

const SYSTEM_PROMPT = `Você analisa transcrições de áudios de captadores do mercado imobiliário e extrai oportunidades estruturadas.

O captador conversa com um cliente em potencial e descreve oralmente o interesse imobiliário dele. Sua tarefa é registrar os dados usando a ferramenta registrar_lead.

Regras:
- Se algum campo não foi mencionado, OMITA o campo (não invente)
- "categoria" deve ser inferida pelo contexto: alugar/locar = aluguel; comprar para morar = venda; comprar para render aluguel/valorizar = investimento; terreno/obra/reforma/construir = construcao
- "descricao" deve ser um resumo conciso (1-2 frases) da oportunidade, em português, escrito do ponto de vista do comercial que vai fazer follow-up
- Nunca invente dados que não estão na transcrição. Prefira omitir.`

const TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'registrar_lead',
    description: 'Registra a oportunidade imobiliária extraída da transcrição do áudio do captador',
    parameters: {
      type: 'object',
      properties: {
        categoria: {
          type: ['string', 'null'],
          enum: ['aluguel', 'venda', 'investimento', 'construcao', null],
          description: 'Categoria do interesse, ou null se não estiver claro pela transcrição.'
        },
        nome_cliente: {
          type: ['string', 'null'],
          description: 'Nome do cliente, ou null se não mencionado'
        },
        telefone_cliente: {
          type: ['string', 'null'],
          description: 'Telefone do cliente, ou null se não mencionado'
        },
        descricao: {
          type: 'string',
          description: 'Resumo conciso de 1-2 frases da oportunidade'
        },
        caracteristicas: {
          type: 'object',
          properties: {
            tipo_imovel: {
              type: ['string', 'null'],
              description: 'Apartamento, casa, terreno, sala comercial, etc.'
            },
            quartos: { type: ['number', 'null'] },
            bairro: { type: ['string', 'null'] },
            cidade: { type: ['string', 'null'] },
            faixa_preco: {
              type: ['string', 'null'],
              description: 'Valor ou faixa mencionada, como "até 500 mil" ou "entre 3 e 4 mil"'
            },
            urgencia: {
              type: ['string', 'null'],
              enum: ['baixa', 'media', 'alta', null]
            },
            observacoes: {
              type: ['string', 'null'],
              description: 'Qualquer detalhe relevante não capturado pelos outros campos'
            }
          }
        }
      },
      required: ['descricao', 'caracteristicas']
    }
  }
}

export async function extractLead(transcricao: string): Promise<LeadExtraido> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Transcrição:\n\n${transcricao}` }
    ],
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'function', function: { name: 'registrar_lead' } }
  })

  const toolCall = response.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall) {
    throw new Error('LLM não retornou tool_call')
  }

  const input = JSON.parse(toolCall.function.arguments) as Partial<LeadExtraido>
  return {
    categoria: input.categoria ?? null,
    nome_cliente: input.nome_cliente ?? null,
    telefone_cliente: input.telefone_cliente ?? null,
    descricao: input.descricao ?? '',
    caracteristicas: input.caracteristicas ?? {}
  }
}
