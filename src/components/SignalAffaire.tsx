import { FileText } from 'lucide-react'

export const GOOGLE_DOC_URL_RE = /^https:\/\/(docs|drive)\.google\.com\//i

export function isValidGoogleDocUrl(url: string): boolean {
  return GOOGLE_DOC_URL_RE.test(url.trim())
}

export interface DocLinks {
  contact?: string | null
  entreprise?: string | null
}

/** Pastille « signal d'affaire » pour les listes : cliquable si un seul lien, sinon liste les deux. */
export function SignalBadge({ contact, entreprise }: DocLinks) {
  const links = [
    entreprise ? { label: 'Doc entreprise', url: entreprise } : null,
    contact ? { label: 'Doc contact', url: contact } : null,
  ].filter(Boolean) as { label: string; url: string }[]

  if (links.length === 0) return <span className="text-xs text-muted-foreground">—</span>

  return (
    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
      {links.map(l => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${l.label} — ouvrir le Google Doc`}
          className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-500/25 dark:text-blue-300"
        >
          <FileText className="h-3 w-3" />
          {l.label === 'Doc entreprise' ? 'Ent.' : 'Contact'}
        </a>
      ))}
    </div>
  )
}

/** Bouton lecture seule dans les drawers. */
export function DocLinkButton({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <FileText className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}
