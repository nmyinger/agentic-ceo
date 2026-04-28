import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">404</p>
          <h1 className="text-2xl font-bold text-zinc-200">Page not found</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            This page doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-white text-zinc-900 font-semibold px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors text-sm"
        >
          ← Back to Kora
        </Link>
      </div>
    </main>
  )
}
