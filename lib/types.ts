export type Categoria = 'aluguel' | 'venda' | 'investimento' | 'construcao'
export type StatusLead =
  | 'novo'
  | 'em_atendimento'
  | 'qualificado'
  | 'fechado'
  | 'perdido'
export type Papel = 'captador' | 'comercial' | 'admin'

export type Lead = {
  id: string
  created_at: string
  captador_id: string | null
  comercial_id: string | null
  audio_url: string | null
  whatsapp_media_id: string | null
  transcricao: string | null
  categoria: Categoria | null
  nome_cliente: string | null
  telefone_cliente: string | null
  descricao: string | null
  caracteristicas: Record<string, unknown>
  status: StatusLead
  confirmado_captador: boolean
  captador?: { nome: string } | null
  comercial?: { nome: string } | null
}
