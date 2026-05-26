import './globals.css'

export const metadata = {
  title: 'Conecta Imob',
  description: 'Plataforma interna de captação imobiliária'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  )
}
