# DESIGN.md — DigiLeads UI System

Référence du système de design appliqué à l'application DigiLeads. À maintenir en parallèle du code.

---

## Charte de marque Digilityx

| Rôle | Hex | Usage |
|------|-----|-------|
| **Navy** | `#050d2b` | Fond sidebar, badges données, filtres actifs |
| **Coral** | `#f44242` | Couleur brand brute (halos décoratifs Login) |
| **Coral accessible** | `#d03030` | Primary — boutons, liens, actions (passe WCAG 4.5:1 sur blanc) |
| **Coral clair** | `#f66868` | Texte coral sur fond navy (sidebar wordmark, passe 4.5:1 sur `#050d2b`) |
| **Green** | `#21b087` | Marque — non utilisé dans l'UI actuelle |
| **Cyan** | `#45d1db` | Halos décoratifs Login, Tier 2 |

**Typographie :** Montserrat (Google Fonts) — 400, 500, 600, 700, 800. Fallback : system-ui, sans-serif.

**Dark mode :** non prévu. Les couleurs hard-codées (`#050d2b`, etc.) sont intentionnelles.

---

## Tokens CSS (`src/index.css` — `@theme`)

```
--color-background:   #f7f8fa   (paper off-white)
--color-foreground:   #050d2b   (navy)
--color-card:         #ffffff
--color-primary:      #d03030   (coral accessible)
--color-muted:        #eef0f4
--color-muted-foreground: #646878  (passe 4.5:1 sur paper)
--color-destructive:  #b45309   (amber — distinct du coral)
--color-sidebar-background: #050d2b
--color-sidebar-accent-foreground: #f66868  (coral clair)
--color-data-navy:    #050d2b   (token pour badges de données)
```

Les tokens oktlch sont définis dans `:root` pour shadcn/ui (fichier `src/index.css` section `@layer base`).

---

## Règle sémantique des couleurs

| Couleur | Rôle | Exemples |
|---------|------|---------|
| **Coral `#d03030`** | Actions primaires uniquement | Bouton "Enregistrer", lien "Voir sur LinkedIn", bouton Login |
| **Navy `#050d2b`** | Données, badges, états sélectionnés | Badges relation, tier 1, compteurs, filtre actif |
| **Vert `green-500/15` + `text-green-700`** | Signal positif | ICP Oui, Deal en cours, score élevé |
| **Cyan `cyan-500/15` + `text-cyan-700`** | Secondaire, en progression | Tier 2, statut "Activement démarché" |
| **Amber `amber-500/15` + `text-amber-700`** | Attention, niveau inférieur | Tier 3, score moyen, filiale non rattachée |
| **Muted** | Neutre, inactif | Tier Hors-Tier, ICP Non, "À démarcher" |

> **Règle absolue :** le coral ne s'utilise que pour les éléments interactifs (boutons, liens). Les badges de données utilisent navy ou les couleurs sémantiques ci-dessus.

---

## Système de badges

Tous les badges de données utilisent des `<span>` inline, pas le composant `<Badge>` shadcn, pour contrôler finement les couleurs :

```tsx
// Tier 1
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#050d2b] text-white">
  Tier 1
</span>

// Tier 2
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
  Tier 2
</span>

// Tier 3
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300">
  Tier 3
</span>

// Hors-Tier
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
  Hors-Tier
</span>

// ICP Oui
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/15 text-green-700 dark:text-green-300">
  Oui
</span>

// Compteur (relation, score)
<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[#050d2b] text-white">
  42
</span>
```

Le composant `<Badge>` reste utilisé uniquement pour les badges secteur (`variant="outline"`).

---

## Statuts entreprise — couleurs

| Statut | Style |
|--------|-------|
| À démarcher | `bg-muted text-muted-foreground` |
| Activement démarché | `bg-cyan-500/15 text-cyan-700` |
| Deal en cours | `bg-green-500/15 text-green-700` |
| Devenu client Digileads | `bg-[#050d2b] text-white` |

---

## Filtres actifs

Classe uniforme sur tous les filtres sélectionnés (Entreprises, Contacts, Membres) :

```
border-[#050d2b] bg-[#050d2b]/10 text-[#050d2b] font-semibold
```

Cases à cocher sélectionnées :
```
bg-[#050d2b] border-[#050d2b] text-white
```

Cases à cocher natives (`accent`) :
```
accent-[#050d2b]
```

---

## Layout — Sidebar collapsible

- **Largeur étendue :** `w-64` (256px)
- **Largeur réduite :** `w-14` (56px) — icônes uniquement, titres en tooltip `title`
- **Fond :** `linear-gradient(160deg, rgba(208,48,48,0.10) 0%, transparent 38%), #050d2b` — halo coral subtil en haut
- **Transition :** `width 200ms ease` — désactivée si `prefers-reduced-motion: reduce`
- **Persistance :** `localStorage` clé `'sidebar-collapsed'`
- **Main content padding :** `md:pl-14` ou `md:pl-64` selon état, avec transition `padding-left 200ms ease` (également désactivée pour reduced-motion)

---

## Dashboard

- **Halos atmosphériques :** deux radial-gradients CSS sur le wrapper (coral 7% haut-droite, cyan 5% bas-gauche) — même signature que la Login, atténuée
- **Stat cards :** `rounded-xl border border-[#050d2b]/12 shadow-md` + gradient `rgba(5,13,43,0.03)` en arrière-plan — hover `shadow-lg`
- **Cartes de section :** `rounded-xl border border-[#050d2b]/12 shadow-sm`
- **Graphe Tier :** barres colorées Tier 1 navy / Tier 2 cyan / Tier 3 amber / Hors-Tier muted

---

## Page Login

- **Fond :** navy `#050d2b` avec 4 halos (2 coral, 2 cyan), texture noise SVG `opacity-20`, grille `opacity-0.04`
- **Card :** `backdrop-blur-2xl bg-white/[0.04] border-white/10` — glassmorphisme
- **Inputs :** `bg-white/[0.06] border-white/10`, focus `border-[#f44242]/60 ring-[#f44242]/20`
- **Bouton :** `bg-[#d03030] hover:bg-[#b52828]` + `hover:shadow-[#d03030]/25`
- **Labels :** associés aux inputs via `htmlFor`/`id` (WCAG 1.3.1)
- **Autocomplete :** `autoComplete="email"` et `autoComplete="current-password"`

---

## Accessibilité — points clés

- **Contraste primary** : `#d03030` sur blanc → 4.6:1 ✅ (WCAG AA)
- **Contraste muted-foreground** : `#646878` sur paper `#f7f8fa` → 4.5:1 ✅
- **Contraste sidebar accent** : `#f66868` sur navy `#050d2b` → 4.5:1 ✅
- **prefers-reduced-motion** : transitions sidebar/layout désactivées si préférence système active
- **Boutons icon-only** : `aria-label` obligatoire (sidebar toggle, logout en mode réduit)
- **Touch targets** : minimum `p-3` sur les boutons icon-only (≈48px)
- **Formulaires** : `htmlFor` + `id` + `autoComplete` sur tous les inputs

---

## Icônes

- Bibliothèque : **Lucide React** — stroke uniforme, `currentColor`
- `DigiIcon` : SVG D-mark Digilityx (`src/components/icons/DigiIcon.tsx`), `fill="currentColor"`, `aria-hidden="true"`
- Favicon : `public/favicon.svg` — fond navy `#050d2b` avec éclair coral `#f44242`
- Emoji ou icônes Unicode : interdits dans l'UI

---

## Composants notables

| Composant | Fichier | Notes |
|-----------|---------|-------|
| `Sidebar` | `src/components/layout/Sidebar.tsx` | Collapsible, état localStorage |
| `Layout` | `src/components/layout/Layout.tsx` | Gère collapsed state, transitions reduced-motion |
| `EntrepriseDrawer` | `src/components/entreprises/EntrepriseDrawer.tsx` | Tier/ICP calculés auto depuis typology+secteur |
| `ContactDrawer` | `src/components/contacts/ContactDrawer.tsx` | Score live, relations par membre |
| `DigiIcon` | `src/components/icons/DigiIcon.tsx` | D-mark Digilityx SVG |
| `SecteurMultiSelect` | `src/pages/Entreprises.tsx` | Dropdown custom multi-sélection |
