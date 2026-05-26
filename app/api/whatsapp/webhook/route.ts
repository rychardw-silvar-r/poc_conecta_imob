import { NextRequest, NextResponse, after } from 'next/server'
import {
  downloadWhatsAppMedia,
  sendWhatsAppText,
  verifyWebhookSignature
} from '@/lib/whatsapp'
import { transcribeAudio } from '@/lib/transcribe'
import { extractLead, type LeadExtraido } from '@/lib/extract'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Handshake de verificação do webhook (Meta chama uma vez ao configurar)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// Recebimento de mensagens
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody) as WhatsAppPayload
  const audio = extractAudioMessage(payload)

  // Responde 200 imediatamente; processa em background pra não estourar timeout
  if (audio) {
    after(async () => {
      try {
        await processAudioMessage(audio)
      } catch (err) {
        console.error('[whatsapp-webhook] erro processando áudio', err)
        await sendWhatsAppText(
          audio.from,
          'Tive um problema ao processar seu áudio. Tente novamente em instantes.'
        ).catch(() => {})
      }
    })
  }

  return NextResponse.json({ ok: true })
}

// ----------------------------------------------------------------------
// Tipos e parsing do payload do WhatsApp
// ----------------------------------------------------------------------

type WhatsAppPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string
          from: string
          type: string
          audio?: { id: string; mime_type: string }
        }>
      }
    }>
  }>
}

type IncomingAudio = {
  from: string // E.164 sem '+', conforme Meta envia
  mediaId: string
  messageId: string
}

function extractAudioMessage(payload: WhatsAppPayload): IncomingAudio | null {
  const msg = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (!msg || msg.type !== 'audio' || !msg.audio) return null
  return { from: msg.from, mediaId: msg.audio.id, messageId: msg.id }
}

// ----------------------------------------------------------------------
// Pipeline principal
// ----------------------------------------------------------------------

async function processAudioMessage(msg: IncomingAudio): Promise<void> {
  const supabase = supabaseAdmin()
  const fromE164 = '+' + msg.from

  // Idempotência: se já processamos esse media_id, encerra
  const { data: existente } = await supabase
    .from('leads')
    .select('id')
    .eq('whatsapp_media_id', msg.mediaId)
    .maybeSingle()
  if (existente) return

  // 1. Captador precisa estar cadastrado
  const { data: captador } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('telefone', fromE164)
    .eq('papel', 'captador')
    .eq('ativo', true)
    .maybeSingle()

  if (!captador) {
    await sendWhatsAppText(
      msg.from,
      'Olá! Seu número não está cadastrado como captador no Conecta Imob. Fale com o administrador.'
    )
    return
  }

  // 2. Baixar áudio do WhatsApp
  const { buffer, mimeType } = await downloadWhatsAppMedia(msg.mediaId)

  // 3. Salvar áudio no Supabase Storage (auditoria)
  const ext = mimeType.includes('ogg') ? 'ogg' : 'm4a'
  const path = `audios/${msg.messageId}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from('audios-captacao')
    .upload(path, buffer, { contentType: mimeType, upsert: true })
  if (uploadErr) throw uploadErr

  const {
    data: { publicUrl }
  } = supabase.storage.from('audios-captacao').getPublicUrl(path)

  // 4. Transcrever
  const transcricao = await transcribeAudio(buffer, mimeType)

  // 5. Extrair dados estruturados
  const dados = await extractLead(transcricao)

  // 6. Atribuir comercial via round-robin baseado no total de leads
  const comercial_id = await escolherComercial(supabase)

  // 7. Inserir lead
  const { error: insertErr } = await supabase.from('leads').insert({
    captador_id: captador.id,
    comercial_id,
    audio_url: publicUrl,
    whatsapp_media_id: msg.mediaId,
    transcricao,
    categoria: dados.categoria,
    nome_cliente: dados.nome_cliente,
    telefone_cliente: dados.telefone_cliente,
    descricao: dados.descricao,
    caracteristicas: dados.caracteristicas
  })
  if (insertErr) throw insertErr

  // 8. Confirmar com o captador
  await sendWhatsAppText(msg.from, montarConfirmacao(dados))
}

async function escolherComercial(
  supabase: ReturnType<typeof supabaseAdmin>
): Promise<string | null> {
  const { data: comerciais } = await supabase
    .from('usuarios')
    .select('id')
    .eq('papel', 'comercial')
    .eq('ativo', true)
    .order('id')

  if (!comerciais || comerciais.length === 0) return null

  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  const idx = (count ?? 0) % comerciais.length
  return comerciais[idx].id
}

function montarConfirmacao(d: LeadExtraido): string {
  const linhas: string[] = ['Lead registrado.', '']
  if (d.nome_cliente) linhas.push(`Cliente: ${d.nome_cliente}`)
  if (d.categoria) linhas.push(`Categoria: ${d.categoria}`)
  if (d.caracteristicas.tipo_imovel) linhas.push(`Imóvel: ${d.caracteristicas.tipo_imovel}`)
  if (d.caracteristicas.bairro) linhas.push(`Bairro: ${d.caracteristicas.bairro}`)
  if (d.caracteristicas.faixa_preco) linhas.push(`Valor: ${d.caracteristicas.faixa_preco}`)
  linhas.push('')
  linhas.push(d.descricao)
  linhas.push('')
  linhas.push('Se algo estiver errado, me responda com a correção.')
  return linhas.join('\n')
}
