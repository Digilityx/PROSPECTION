import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 -z-10 bg-[#050d2b]">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-[#f44242]/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[55%] rounded-full bg-[#45d1db]/15 blur-[120px]" />
        <div className="absolute top-[30%] right-[20%] w-[35%] h-[40%] rounded-full bg-[#f44242]/10 blur-[100px]" />
        <div className="absolute bottom-[20%] left-[15%] w-[30%] h-[35%] rounded-full bg-[#45d1db]/08 blur-[80px]" />
        {/* Noise overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
          backgroundSize: '128px 128px',
        }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl px-10 py-10 shadow-2xl shadow-black/20">
          {/* Logo + Title */}
          <div className="text-center space-y-4 mb-10">
            <div className="flex justify-center">
              <svg width="52" height="52" viewBox="0 0 32 32" fill="none" aria-label="DigiLeads">
                <circle cx="16" cy="16" r="14" fill="#f44242"/>
                <path fill="white" transform="translate(6,6.4) scale(0.417)" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Digi<span className="text-[#f66868]">Leads</span>
              </h1>
              <p className="text-sm text-white/50 mt-1">Plateforme de détection de leads</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2.5">
              <label htmlFor="email" className="text-sm font-medium text-white/70">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom.nom@digilityx.com"
                required
                autoComplete="email"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 text-sm text-white placeholder:text-white/30 outline-none focus-visible:border-[#f44242]/60 focus-visible:ring-2 focus-visible:ring-[#f44242]/20 transition-all"
              />
            </div>

            <div className="space-y-2.5">
              <label htmlFor="password" className="text-sm font-medium text-white/70">Mot de passe</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 text-sm text-white placeholder:text-white/30 outline-none focus-visible:border-[#f44242]/60 focus-visible:ring-2 focus-visible:ring-[#f44242]/20 transition-all"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-[#d03030] hover:bg-[#b52828] text-white font-medium transition-all hover:shadow-lg hover:shadow-[#d03030]/25"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Se connecter
            </Button>
          </form>

        </div>
      </div>
    </div>
  )
}
