import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'mp3'
  const file = new File([buffer], `audio.${ext}`, { type: mimeType })

  const result = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language: 'pt'
  })

  return result.text
}
