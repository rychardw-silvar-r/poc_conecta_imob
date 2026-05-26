import crypto from 'crypto'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN!

  const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!metaRes.ok) {
    throw new Error(`Falha ao obter metadados da mídia: ${metaRes.status}`)
  }
  const meta = (await metaRes.json()) as { url: string; mime_type: string }

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!fileRes.ok) {
    throw new Error(`Falha ao baixar mídia: ${fileRes.status}`)
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer())

  return { buffer, mimeType: meta.mime_type }
}

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const token = process.env.WHATSAPP_ACCESS_TOKEN!

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Falha ao enviar mensagem WhatsApp: ${res.status} ${err}`)
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) return false

  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')

  if (expected.length !== signature.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
