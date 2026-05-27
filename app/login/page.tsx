import { sendMagicLink } from './actions'
import { ThemeToggle } from '../theme-toggle'

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
        className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm"
      >
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Conecta Imob</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Entrar via link mágico no seu email.
            </p>
          </div>
          <ThemeToggle />
        </header>
        <input
          type="email"
          name="email"
          required
          placeholder="seu@email.com"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-400 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300"
        >
          Enviar link
        </button>
        {params.sent && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Link enviado. Verifique sua caixa de entrada.
          </p>
        )}
        {params.error && (
          <p className="text-sm text-red-700 dark:text-red-400">
            {decodeURIComponent(params.error)}
          </p>
        )}
      </form>
    </main>
  )
}
