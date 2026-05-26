import { sendMagicLink } from './actions'

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; sent?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        action={sendMagicLink}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <header>
          <h1 className="text-xl font-semibold">Conecta Imob</h1>
          <p className="text-sm text-zinc-500">
            Entrar via link mágico no seu email.
          </p>
        </header>
        <input
          type="email"
          name="email"
          required
          placeholder="seu@email.com"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Enviar link
        </button>
        {params.sent && (
          <p className="text-sm text-green-700">
            Link enviado. Verifique sua caixa de entrada.
          </p>
        )}
        {params.error && (
          <p className="text-sm text-red-700">
            {decodeURIComponent(params.error)}
          </p>
        )}
      </form>
    </main>
  )
}
