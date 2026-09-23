# CLAUDE.md — DigiLeads (état au 23/09/2026)

## Vue d'ensemble

Application web interne Digilityx pour détecter, qualifier et prioriser des leads B2B après scraping LinkedIn (Phantombuster). Elle enrichit, score et priorise les contacts et entreprises pour les équipes commerciales.

**Stack technique :**
- **Frontend :** React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Recharts
- **Backend / BDD :** Supabase exclusivement (PostgreSQL + Auth + Realtime + Edge Functions)
- **IA / LLM :** Claude API — appelé uniquement via Supabase Edge Functions
- **Déploiement :** GitHub Pages (GitHub Actions → branche `gh-pages`) + `vercel.json` présent pour routing SPA si Vercel utilisé

---

## Contrainte absolue — Site 100% statique

L'application est déployée sur **GitHub Pages** (fichiers statiques uniquement).

### Interdit côté frontend
- Logique serveur (pas de Next.js API Routes, SSR, Server Components)
- Appel direct à l'API Anthropic (exposition de clés)
- Appel direct à l'API Slack
- `@supabase/ssr` ou tout package lié au rendu serveur
- `ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` dans les variables frontend

### Autorisé côté frontend
- Appels Supabase via `supabase-js` (clé `anon` uniquement)
- Appels aux **Supabase Edge Functions** (qui détiennent les secrets)
- Authentification Supabase Auth
- Temps réel via Supabase Realtime

### Variables d'environnement

**Frontend (`.env`) — uniquement les clés publiques :**
```env
VITE_SUPABASE_URL=https://pcxcdhhxnqbxfrqxnikj.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

**Supabase Edge Functions (secrets Dashboard — jamais dans le frontend) :**
```
ANTHROPIC_API_KEY
SLACK_BOT_TOKEN
SLACK_CHANNEL_ID
SUPABASE_SERVICE_ROLE_KEY
```

---

## Rôles utilisateurs

Les rôles sont portés par le champ `role` sur `membres_digilityx` (pas une table séparée).

| Rôle | Accès |
|------|-------|
| `admin` | Toutes les pages : Dashboard, Entreprises, Contacts, Membres, Notifications, Import |
| `account_manager` | Contacts + Entreprises uniquement (même accès que membre) |
| `membre` | Contacts + Entreprises uniquement |

**Règle d'accès :** un membre doit avoir `partager_contacts = true` pour pouvoir se connecter. Si `partager_contacts = false`, la connexion est refusée même avec des identifiants valides.

**Connexion liée à `membres_digilityx` :** le champ `auth_user_id` lie un compte Supabase Auth à un membre. Le rôle est lu au moment de la connexion et stocké dans le contexte React (`AuthProvider`).

---

## Schéma de la base de données

### Table : `membres_digilityx`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `first_name` / `last_name` | TEXT | |
| `full_name` | TEXT (généré) | `first_name || ' ' || last_name` |
| `role` | TEXT | `'membre'` \| `'account_manager'` \| `'admin'` |
| `email` | TEXT | |
| `slack_user_id` | TEXT | |
| `auth_user_id` | UUID | Lien vers Supabase Auth |
| `actif` | BOOLEAN | `true` par défaut — membre encore présent chez Digi |
| `partager_contacts` | BOOLEAN | `true` par défaut — ses contacts exclusifs sont visibles des autres |
| `consent` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

**Règle :** quand `actif` passe à `false`, `partager_contacts` est forcé à `false` automatiquement (trigger `sync_partager_contacts_on_depart`). Si ce membre existait aussi comme contact dans la base, passer son contact en `is_digi_employee = true` pour l'exclure de la prospection.

---

### Table : `entreprises`

Colonnes principales :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `company_name` | TEXT NOT NULL | |
| `company_website` / `company_domain` | TEXT | |
| `company_id_linkedin` | TEXT UNIQUE | |
| `company_employee_count` | INTEGER | Effectif exact |
| `company_employee_range` | TEXT | Range textuel Phantombuster |
| `company_location` | TEXT | |
| `company_typology` | TEXT | `Grand Groupe` \| `ETI` \| `PME` \| `TPE` \| `Startup` |
| `secteur_digi` | TEXT | Voir liste des 16 secteurs ci-dessous |
| `linkedin_industry` | TEXT | Secteur brut LinkedIn |
| `icp` | BOOLEAN | Calculé automatiquement par trigger |
| `tier` | TEXT | `Tier 1` \| `Tier 2` \| `Tier 3` \| `Hors-Tier` — calculé par trigger |
| `statut_entreprise` | TEXT | `À démarcher` \| `Activement démarché` \| `Deal en cours` \| `Devenu client Digileads` |
| `statut_digi` | TEXT | `Client Digi - pas de mission` \| `Client Digi - mission en cours` \| `Pas client Digi` \| `Client Digileads` |
| `is_digi_client` | BOOLEAN | Calculé automatiquement depuis `statut_digi` |
| `owner` | UUID → `membres_digilityx.id` | Propriétaire de l'entreprise |
| `account_manager_id` | UUID → `membres_digilityx.id` | AM affecté (peut être auto-assigné) |
| `is_placeholder` | BOOLEAN | Entreprise temporaire sans données réelles |
| `is_subsidiary` / `is_parent_entity` | BOOLEAN | Hiérarchie groupe/filiale |
| `parent_company_id` | UUID → `entreprises.id` | |
| `company_website_from_linkedin` | TEXT | |
| `company_description` / `company_specialties` | TEXT | |
| `source_acquisition` | TEXT | |
| `justification` | TEXT | |
| `scoring_icp` | INTEGER | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**16 secteurs `secteur_digi` :**
Pharma/Santé, BAF, Éducation & Formation, Tourisme Hôtellerie & Loisirs, Technologie & IT, Prestations aux entreprises, Media & Communication, Recrutement, Commerce de Détail, Luxe, Services aux Consommateurs, Industrie & Énergie, Transports & Logistique, Immobilier & Construction, Public & Administrations, Concurrent

---

### Table : `contacts`

Colonnes principales :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `linkedin_url` | TEXT UNIQUE | |
| `id_url_linkedin` | TEXT | |
| `first_name` / `last_name` / `full_name` (généré) | TEXT | |
| `position` | TEXT | Poste actuel |
| `email` / `location` | TEXT | |
| `company_name` | TEXT | Nom brut LinkedIn |
| `company_id_linkedin` | TEXT | |
| `entreprise_id` | UUID → `entreprises.id` | Rattachement entreprise |
| `years_in_position` / `months_in_position` | NUMERIC | |
| `years_in_company` / `months_in_company` | NUMERIC | |
| `summary` / `title_description` | TEXT | Profil LinkedIn |
| `connection_degree` | TEXT | |
| `is_premium` / `is_open_link` | BOOLEAN | |
| `shared_connections_count` | INTEGER | |
| `profile_image_url` / `default_profile_url` | TEXT | |
| `last_scraped_at` | TIMESTAMPTZ | |
| `persona` | TEXT | `Dirigeant` \| `Marketing` \| `Produit` \| `Design` \| `Commercial` \| `Acheteur` \| `Hors expertise Digi` |
| `hierarchie` | TEXT | `COMEX` \| `Directeur` \| `Manager` \| `Opérationnel` \| `Stagiaire/Alternant` |
| `contact_digi` | BOOLEAN | **Contact réservé** — piloté automatiquement par `historique_relationnel` : `true` si `historique_relationnel = 'Réservé'`, `false` sinon. Plus de case à cocher manuelle. |
| `statut_contact` | TEXT | `Sélectionné` \| `À contacter` \| `Contacté` \| `Intéressé` \| `Pas intéressé` \| `Client à date` \| `Client Digileads` — chaque changement est loggué automatiquement dans `qualification_logs` |
| `historique_relationnel` | TEXT | `Jamais contacté` \| `Réservé` \| `Deal en cours` \| `Mission en cours` \| `A recontacter N+1` \| `En attente de retour` \| `Ancien client Digi` — qualifié manuellement dans le drawer. Sélectionner "Réservé" met automatiquement `contact_digi = true`. |
| `last_message_sent_at` | TIMESTAMPTZ | Date du dernier "Message à envoyer" marqué comme envoyé pour ce contact (depuis la vue Contacts par Owner). |
| `niveau_de_relation` | TEXT | Valeur cache — maintenue par trigger depuis `contacts_membres_relations` |
| `scoring` | INTEGER | Calculé automatiquement par trigger (max 100) |
| `nb_personnes_digi_relation` | INTEGER | Cache — maintenu par trigger |
| `owner_membre_id` | UUID → `membres_digilityx.id` | |
| `masque` | BOOLEAN | `true` si tous les membres liés ont `partager_contacts = false` |
| `query` | TEXT | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

---

### Contacts réservés (`contact_digi = true`)

Le champ `contact_digi` marque un contact comme **réservé** — contacts ciblés avant la création de l'app DigiLeads, exclus de la prospection active mais toujours visibles dans l'app.

**Règles de visibilité par rôle :**

| Rôle | Voit le contact | Voit le badge "Réservé" | Peut ouvrir le drawer |
|------|----------------|------------------------|-----------------------|
| `membre` | ✅ | ❌ | ❌ |
| `account_manager` | ✅ | ✅ (badge orange) | ❌ |
| `admin` | ✅ | ✅ (badge orange) | ✅ (peut cocher/décocher) |

**Comportement UI :**
- `contact_digi` est piloté automatiquement par la liste déroulante "Historique relationnel" dans le drawer : sélectionner "Réservé" passe `contact_digi = true`, tout autre choix le repasse à `false`.
- Plus de case à cocher manuelle ni de bouton "Masquer les réservés".
- Un filtre "Historique relationnel" est disponible dans la liste contacts (onglet Tout) pour filtrer par valeur.
- En vue membre (scoped), les contacts réservés du réseau du membre sont chargés séparément (requête complémentaire, hors RPC) et ajoutés en fin de liste.

**Règle d'import :** ne jamais écraser `contact_digi` sur un contact existant lors d'un import.

**Nom de colonne :** `contact_digi` (interne) — le label UI est "Réservé". Pas besoin de renommer la colonne, les RPCs et triggers utilisent `contact_digi`.

---

### Contacts devenus collaborateurs Digilityx (`is_digi_employee = true`)

Le champ `is_digi_employee` marque un contact qui a rejoint Digilityx — il ne doit plus apparaître dans les listes de prospection.

**Différence avec `contact_digi` :**
- `contact_digi = true` → réservé (ciblé avant DigiLeads, visible avec badge)
- `is_digi_employee = true` → chez Digi (invisible partout, aucun badge)

**Comportement :** entièrement exclu de toutes les vues et RPCs. Pas de badge, pas de toggle. Le contact disparaît simplement des listes.

**RPCs mises à jour** (`AND NOT c.is_digi_employee`) : `get_contacts_for_membre`, `count_contacts_for_membre`, `get_owner_a_contacter_contacts`, `get_membre_tier1_unqualified_count`.

**Vue admin :** filtre `.eq('is_digi_employee', false)` appliqué systématiquement — même les admins ne les voient pas dans `/contacts`.

**Pour marquer un contact :** ouvrir le drawer (admin) → cocher "Ce contact est maintenant chez Digilityx", ou via SQL :
```sql
UPDATE contacts SET is_digi_employee = true WHERE id = '<uuid>';
```

**Règle d'import :** ne jamais écraser `is_digi_employee` sur un contact existant lors d'un import.

---

### Table : `qualification_logs`

Historique des changements de champs sur les contacts (et potentiellement entreprises à terme).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | |
| `entity_type` | TEXT | `'contact'` \| `'entreprise'` |
| `entity_id` | UUID | ID du contact ou de l'entreprise |
| `field_changed` | TEXT | Nom du champ modifié (ex : `'statut_contact'`) |
| `old_value` | TEXT | Valeur avant le changement (`NULL` pour les entrées initiales) |
| `new_value` | TEXT | Valeur après le changement |
| `source` | TEXT | `'manual'` \| `'llm'` \| `'phantombuster'` \| `'import'` \| `'trigger'` |
| `metadata` | JSONB | Données complémentaires |
| `created_by` | UUID | |
| `created_at` | TIMESTAMPTZ | Date exacte du changement |

**Alimentée automatiquement** par le trigger `trg_log_statut_contact_change` à chaque modification de `statut_contact`. Les entrées initiales (import du 23/09/2026) ont `old_value = NULL` et `source = 'import'`.

**Requête utile :**
```sql
SELECT old_value, new_value, created_at
FROM qualification_logs
WHERE entity_type = 'contact' AND entity_id = '<uuid>' AND field_changed = 'statut_contact'
ORDER BY created_at DESC;
```

---

### Table : `contacts_membres_relations`

Relation many-to-many entre contacts et membres.

| Colonne | Type |
|---------|------|
| `contact_id` | UUID → `contacts.id` |
| `membre_id` | UUID → `membres_digilityx.id` |
| `niveau_de_relation` | TEXT (par membre) |
| `connection_degree` | `'1st'` \| `'2nd'` \| `'3rd'` |
| `notes` | TEXT |
| `scoring` | INTEGER (dénormalisé) |
| `company_name` | TEXT (dénormalisé) |
| `entreprise_id` | UUID (dénormalisé) |

---

## Règles de scoring et de qualification

### Tier / ICP (calculé automatiquement par trigger)

| Condition | Tier | ICP |
|-----------|------|-----|
| `company_typology` NULL, TPE ou Startup | Hors-Tier | Non |
| `secteur_digi = 'Concurrent'` | Hors-Tier | Non |
| Typologie éligible × secteur NULL | Tier 3 | Non spécifié |
| Secteur = Pharma/Santé ou BAF | **Tier 1** | Oui |
| Autres secteurs ICP | **Tier 2** | Oui |

**Dérivation de la typologie depuis l'effectif :**
- ≥ 5000 → Grand Groupe
- ≥ 250 → ETI
- ≥ 10 → PME
- ≥ 1 → TPE

---

### Scoring contact (max 100 pts, calculé automatiquement par trigger)

| Dimension | Valeur | Points |
|-----------|--------|--------|
| **Hiérarchie** | COMEX | 30 |
| | Directeur | 20 |
| | Manager | 15 |
| | Opérationnel | 5 |
| **Persona** | Tout sauf "Hors expertise Digi" | 20 |
| **Niveau de relation** | Ami | 30 |
| | Ancien collègue / Alumni / Partenaire business / Cercle familial | 20 |
| | Connaissance | 5 |
| **Nb personnes Digi en relation** | ≥ 3 | 20 |
| | 2 | 10 |
| | 1 | 5 |

---

### Affectation automatique des Account Managers

Trigger `auto_assign_account_manager` — s'exécute sur INSERT/UPDATE de `secteur_digi`, `company_typology`, `is_placeholder` sur `entreprises`.

**Règles :**
- Ne jamais écraser un `account_manager_id` déjà renseigné
- Ne pas affecter les lignes `is_placeholder = true`
- Tirage aléatoire parmi le pool du secteur

| Secteur | Typologie | Pool AM |
|---------|-----------|---------|
| **Pharma/Santé** | toutes | François Coulon, Clément Guichard, Alexandre Koch, Alexandra Martin |
| **BAF** | Grand Groupe | Julien Bechkri, Cindy Renard, Emmanuel Utard, Clément Maria |
| **BAF** | ETI / PME / TPE / null | Christophe Pelletier, Yanis Sif |
| Autres | — | Aucune affectation automatique |

---

## Fonctions SQL (triggers et RPCs)

### Triggers (s'exécutent automatiquement)

| Fonction | Déclencheur | Rôle |
|----------|-------------|------|
| `compute_entreprise_tier_icp` | BEFORE INSERT/UPDATE `company_typology`, `secteur_digi` sur `entreprises` | Calcule `tier` et `icp` |
| `auto_assign_account_manager` | BEFORE INSERT/UPDATE `secteur_digi`, `company_typology`, `is_placeholder` sur `entreprises` | Affecte un AM selon les règles sectorielles |
| `sync_is_digi_client` | BEFORE INSERT/UPDATE `statut_digi` sur `entreprises` | Synchronise `is_digi_client` |
| `compute_contact_scoring` | BEFORE INSERT/UPDATE `hierarchie`, `persona`, `niveau_de_relation`, `nb_personnes_digi_relation` sur `contacts` | Calcule le scoring |
| `sync_partager_contacts_on_depart` | BEFORE UPDATE `actif` sur `membres_digilityx` | Force `partager_contacts = false` si `actif → false` |
| `recompute_contact_masque` | AFTER INSERT/UPDATE/DELETE sur `contacts_membres_relations` | Recalcule `masque` sur le contact |
| `trg_membre_partager_recompute_masque` | AFTER UPDATE `partager_contacts` sur `membres_digilityx` | Recalcule `masque` sur tous les contacts du membre |
| `log_statut_contact_change` (`trg_log_statut_contact_change`) | AFTER UPDATE `statut_contact` sur `contacts` | Insère une ligne dans `qualification_logs` à chaque changement de statut |

### RPCs (appelées depuis le frontend)

| Fonction | Rôle |
|----------|------|
| `get_contacts_for_membre(p_membre_id, filtres…, p_offset, p_limit)` | Liste paginée/filtrée des contacts d'un membre (exclut `masque` et `contact_digi`) |
| `count_contacts_for_membre(p_membre_id, filtres…)` | Comptage avec les mêmes filtres (fast path si aucun filtre) |
| `get_entreprises_for_membre(p_membre_id, filtres…, p_offset, p_limit)` | Liste paginée/filtrée des entreprises liées aux contacts d'un membre |
| `count_entreprises_for_membre(p_membre_id, filtres…)` | Comptage avec les mêmes filtres |
| `get_entreprise_ids_for_membre(p_membre_id)` | UUIDs des entreprises scoped à un membre |
| `get_membre_relations_by_tier()` | Répartition réseau par tier et par membre (membres actifs, contacts non masqués) |
| `get_membre_contact_count()` | Nb de contacts par membre (actifs, partageant, non masqués) |
| `get_membre_tier1_unqualified_count()` | Nb de contacts Tier 1 sans niveau de relation renseigné par membre |
| `contact_counts_for_entreprises(ids)` | Nb de contacts agrégé par `entreprise_id` |
| `get_dashboard_stats()` | 9 compteurs pour le dashboard en un seul appel |
| `get_secteur_stats()` | Nb d'entreprises par secteur |
| `get_owner_a_contacter_contacts(p_owner_id)` | Contacts d'un owner triés par statut (SECURITY DEFINER — contourne RLS). Retourne : id, first_name, last_name, position, company_name, scoring, tier, entreprise_id, niveau_de_relation, account_manager_name, account_manager_slack_user_id, statut_contact, statut_contact_changed_at (dernière date de changement de statut depuis qualification_logs), last_message_sent_at. Ordre : À contacter en premier, puis par scoring DESC. Exclut masque=true et contact_digi=true. |

---

## Edge Functions Supabase

Une seule Edge Function déployée : **`send-slack-notification`**

Prend `{ slack_user_id, message }` dans le body et envoie un DM Slack à l'utilisateur.

**Deux systèmes de relance distincts depuis `/membres` (admin) :**

| Système | Déclencheur | Champ de traçabilité | Envoi |
|---------|-------------|----------------------|-------|
| Relance "qualifier" | Vue Tier ou Vue Membre Digi | `last_slack_nudge_at` (24h, bloque le bouton) | Automatique via Edge Function |
| Relance "Message à envoyer" | Contacts par Owner → colonne "Sélectionné" | `contacts.last_message_sent_at` (par contact, persistant) + `membres_digilityx.last_relance_contact_at` (par membre, date de la dernière action) | **Manuel** — l'admin copie le message et l'envoie lui-même sur Slack |

Les deux systèmes sont **indépendants** : marquer un message comme envoyé ne bloque pas la relance de qualification, et inversement. La date affichée sous "Message envoyé" est lue depuis `contacts.last_message_sent_at` — elle persiste après rechargement.

Les autres fonctions prévues initialement (qualify-with-llm, process-phantombuster, sync-google-sheets) **ne sont pas encore implémentées**.

---

## Vues frontend (routes)

| Route | Rôle requis | Description |
|-------|-------------|-------------|
| `/` | admin | Dashboard — KPIs globaux |
| `/entreprises` | tous | Liste filtrée par tier, statut, secteur, AM |
| `/contacts` | tous | Liste avec scoring, statut, qualification |
| `/membres` | admin | Stats par membre, gestion du réseau — 4 onglets : Contacts par Owner, Entreprises par AM, Vue Tier, Vue Membre Digi |
| `/notifications` | admin | Centre de notifications Slack |
| `/import` | admin | Upload xlsx/csv Phantombuster, enrichissement |

Les rôles `membre` et `account_manager` sont redirigés vers `/contacts` à la connexion.

---

## Conventions de code

- TypeScript strict partout
- `snake_case` pour les colonnes Supabase, `camelCase` pour le TypeScript
- Alias `@/` → `src/` (configuré dans `vite.config.ts`)
- Client Supabase : `supabase-js` v2 avec clé `anon` uniquement — **jamais `@supabase/ssr`**
- Variables frontend préfixées `VITE_` — aucun secret
- Tout appel à une API tierce passe **obligatoirement** par une Edge Function
- Pas de fichier `api/` ni de route serveur dans le frontend

---

## Déploiement

### GitHub Pages (déploiement principal)

```bash
# Push sur main → GitHub Actions build + deploy automatiquement
git push origin main
```

GitHub Actions (`deploy.yml`) : build Vite → publie `./dist` sur la branche `gh-pages`.
Secrets GitHub requis : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Commandes utiles

```bash
# Dev local
npm run dev

# Build + preview local
npm run build && npm run preview

# Générer les types Supabase
npx supabase gen types typescript --project-id pcxcdhhxnqbxfrqxnikj > src/lib/database.types.ts

# Déployer les Edge Functions
npx supabase functions deploy send-slack-notification

# Définir les secrets Edge Functions
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set SLACK_BOT_TOKEN=xoxb-...
```

---

---

## 👥 Membres Digilityx — règles réelles

### Schéma complet de `membres_digilityx` (après migrations)

```sql
id                       UUID PRIMARY KEY (généré automatiquement — ne jamais modifier)
first_name               TEXT NOT NULL
last_name                TEXT NOT NULL
full_name                TEXT GENERATED (first_name || ' ' || last_name)
email                    TEXT
auth_user_id             UUID  -- lié à auth.users.id de Supabase Auth
role                     TEXT  -- 'admin' | 'account_manager' | 'membre'
actif                    BOOLEAN DEFAULT true
partager_contacts        BOOLEAN DEFAULT true
slack_user_id            TEXT   -- identifiant Slack format U... (ex: U017Z701THU)
last_slack_nudge_at      TIMESTAMPTZ  -- dernière relance Slack "qualifier tes contacts" (Vue Tier / Vue Membre Digi)
last_relance_contact_at  TIMESTAMPTZ  -- colonne conservée en base mais plus utilisée côté frontend (remplacée par contacts.last_message_sent_at)
created_at               TIMESTAMPTZ
```

### Règles importantes
- `auth_user_id` = UUID du compte Supabase Auth (Authentication → Users). C'est le lien entre le login et le membre. **Différent du `id` interne de la table.**
- Si `actif = false` → `partager_contacts` est automatiquement passé à `false` (trigger SQL)
- Si `partager_contacts = false` → le membre ne peut **pas se connecter** à l'app (accès refusé dans `auth.tsx`)
- Pour ajouter un membre : créer le compte dans Supabase Auth d'abord (Authentication → Users → Create user), récupérer son UUID, puis INSERT dans `membres_digilityx` avec `auth_user_id` = cet UUID

### Ajouter un membre (SQL)
```sql
INSERT INTO membres_digilityx (first_name, last_name, email, actif, partager_contacts, slack_user_id, auth_user_id, role)
VALUES ('Prénom', 'Nom', 'email@digilityx.com', true, true, 'UXXXXXXXX', '<UUID-Auth>', 'membre');
```

---

## 📥 Import des contacts — règles complètes

### Table clé : `contacts_membres_relations`
Chaque contact peut appartenir au réseau de **plusieurs membres** Digi. La relation est stockée dans `contacts_membres_relations` :
```sql
contact_id          UUID REFERENCES contacts(id)
membre_id           UUID REFERENCES membres_digilityx(id)
niveau_de_relation  TEXT  -- 'Ami', 'Cercle familial', 'Ancien collègue', 'Alumni',
                          --  'Partenaire business', 'Connaissance', 'Non renseigné'
-- Contrainte UNIQUE : (contact_id, membre_id)
```
Le `niveau_de_relation` est **par membre** — un même contact peut avoir une relation différente selon chaque membre Digi.

### Champ `masque` sur `contacts`
Un contact est masqué (`masque = true`) dans deux cas :

**1. Automatiquement (via trigger) :** toutes ses relations membres ont `partager_contacts = false`. Il redevient visible dès qu'un membre actif partageant le pointe. Triggers responsables : `recompute_contact_masque` (sur `contacts_membres_relations`) et `trg_membre_partager_recompute_masque` (sur `membres_digilityx`).

**2. Manuellement lors d'une fusion de doublons :** le contact doublon éliminé est passé à `masque = true` directement par le script (`merge-from-xlsx.mjs`), après transfert de toutes ses relations vers le contact keeper et suppression de ses propres relations. Ce contact reste en base mais n'est plus jamais affiché.

### Règles de déduplication contacts

| Priorité | Critère | Fiabilité |
|----------|---------|-----------|
| 1 | `id_url_linkedin` (ACw...) | ✅ Permanent, ne change jamais |
| 2 | `linkedin_url` | ⚠️ Peut changer si la personne renomme son profil |
| 3 | Ni l'un ni l'autre | → INSERT (nouveau contact) |

**Ne jamais écraser** sur un contact existant : `scoring`, `statut_contact`, `persona`, `hierarchie`, `priorite`, `contact_digi`, `niveau_de_relation`.

**Mettre à jour uniquement si changé** : `position`, `company_name`, `company_id_linkedin`, `location`.

### Règles de déduplication entreprises

| Priorité | Critère |
|----------|---------|
| 1 | `company_id_linkedin` (ID numérique LinkedIn) |
| 2 | Nom normalisé (minuscules, sans accents, sans ponctuation) |
| Si déjà en base | → skip, pas d'écrasement |

### Règles de création de relation
- `niveau_de_relation = 'Non renseigné'` par défaut à l'import
- `ignoreDuplicates: true` → n'écrase jamais une relation existante
- Après chaque import → recalculer `nb_personnes_digi_relation` sur les contacts concernés

### Scripts d'import selon le format

| Format source | Script | Commande |
|---------------|--------|----------|
| Export Pronto / Sales Navigator | `import-pronto.mjs` | `node scripts/import-pronto.mjs --file=fichier.xlsx --membre=<uuid>` |
| Export LinkedIn natif (connexions) | `import-linkedin-connections.mjs` | `node scripts/import-linkedin-connections.mjs --file=fichier.xlsx --membre=<uuid>` |
| Phantombuster CSV (scraping mensuel) | `monthly-import.mjs` | `node scripts/monthly-import.mjs --file=fichier.csv` |
| Entreprises Phantombuster | `import-phantombuster-companies.mjs` | `node scripts/import-phantombuster-companies.mjs --file=fichier.csv` |

> ⚠️ Toujours lancer avec `--dry-run` d'abord pour vérifier le résumé avant d'appliquer.

### Limites par format

**Export LinkedIn natif** : pas de `company_id_linkedin`, pas de `company_name`, pas de `location`, pas d'`id_url_linkedin`. Les contacts arrivent sans rattachement entreprise. Attendre un export Pronto enrichi ou enrichir via Phantombuster.

**Export Pronto** : 3 variantes de colonnes gérées automatiquement par `normalizeRow()` dans le script.

---

## 🔧 Scripts utilitaires

| Script | Usage |
|--------|-------|
| `classify-persona-hierarchie.mjs` | Classifie automatiquement `persona` et `hierarchie` depuis le poste (Tier 1 en priorité). Lancer après chaque import. |
| `import-niveau-relation.mjs` | Met à jour `niveau_de_relation` depuis un fichier Excel fourni par un membre. |
| `detect-merge-duplicates.mjs` | Détecte les doublons contacts (même prénom + nom) et propose une fusion. |
| `merge-from-xlsx.mjs` | Fusionne les doublons validés manuellement dans un xlsx. |
| `enrich-apollo.mjs` | Enrichit les entreprises sans taille via API Apollo.io. |
| `enrich-entreprises-enrichies.mjs` | Applique les données du fichier `ENTREPRISES_ENRICHIES.xlsx` en base. |
| `find-tier1-sans-relation-dans-xlsx.mjs` | Trouve les contacts Tier 1 sans relation membre dans les xlsx existants. |
| `map-industry-to-secteur.mjs` | Mappe les industries LinkedIn vers `secteur_digi`. |
| `verify-classification.mjs` | Vérifie la cohérence des classifications en base vs les règles du script. |

---

## 📊 Page `/membres` — détail des onglets (admin)

### Onglet "Contacts par Owner"
Tableau des membres Digi triés par nombre de contacts dont ils sont owner. Colonnes : Membre, Contacts (total owner), puis une colonne par statut contact (Sélectionné, À contacter, Contacté, Intéressé, Pas intéressé, Client à date, Client Digileads).

**Filtres** : dropdown Statut (filtre par statut_contact) et dropdown Owner (filtre par membre). Les badges statut sont colorés selon la palette : Sélectionné=rouge foncé, À contacter=bleu, Contacté=ambre, Intéressé=vert, Pas intéressé=gris, Client à date=violet, Client Digileads=navy.

**Dates** : sous chaque badge statut s'affiche la date du dernier changement de statut (depuis `qualification_logs`), sauf pour "Sélectionné" qui a sa propre logique.

**Dépliage par membre** : cliquer sur un membre charge via RPC `get_owner_a_contacter_contacts` et affiche les contacts en sous-lignes. Dans la colonne "Sélectionné", un bouton **Message à envoyer** ouvre la modale de prévisualisation.

**Modale prévisualisation** :
- Barre de variables visuelles (Owner, Contact, Poste, Entreprise, Relation, AM) pour voir en un coup d'œil ce qui a été injecté dans le message
- Textarea éditable avec le message personnalisé pré-rempli
- Bouton **Copier** (presse-papiers) pour copier le texte et l'envoyer manuellement sur Slack
- Bouton **Marquer comme envoyé** : enregistre la date dans `last_message_sent_at` sur le contact ET dans `last_relance_contact_at` sur le membre, ferme la modale, et affiche "✓ Message envoyé · il y a Xh" sur la ligne du contact (persistant — lu depuis `contacts.last_message_sent_at`)
- **Pas d'envoi automatique** : l'admin envoie le message lui-même sur Slack en mettant owner et AM en copie

### Onglet "Entreprises par AM"
Tableau des membres Digi en tant qu'Account Manager. Colonnes : Membre, Total entreprises, puis une colonne par statut entreprise.

### Onglet "Vue Tier"
Tableau par membre avec répartition Tier 1 / Tier 2 / Tier 3 / Hors-Tier / Sans tier + colonne "À qualifier T1" (contacts Tier 1 sans niveau de relation). Bouton **Relancer** par ligne (si slack_user_id présent, non bloqué 24h via `last_slack_nudge_at`) → envoi direct sans modale. Bouton global "Relancer les N" en haut → envoie à tous les membres éligibles en une fois.

**Toggle "À qualifier T1 uniquement"** : filtre les membres n'ayant aucun contact Tier 1 à qualifier.

### Onglet "Vue Membre Digi"
Sélecteur de membre + filtres (tier, secteur). Affiche les contacts du membre sélectionné avec leurs détails. Bouton Slack individuel → relance "qualifier" (même règle `last_slack_nudge_at` 24h).

---

## 📋 Page `/contacts` — détail

**Colonnes du tableau :** Contact, Entreprise, Statut, Historique, Relation (scoped uniquement), Digi, Score.

**Badges colorés :**
- `statut_contact` : Sélectionné=rouge foncé, À contacter=bleu, Contacté=ambre, Intéressé=vert, Pas intéressé=gris, Client à date=violet, Client Digileads=navy
- `historique_relationnel` : Réservé=ambre, Deal/Mission en cours=ambre, A recontacter N+1=orange, En attente de retour=bleu, Ancien client Digi=violet, Jamais contacté=gris

**Filtres disponibles :** Tier, Statut contact, Historique relationnel, Owner, Account Manager. Bouton "Effacer" si filtre actif.

---

## 🏢 Page `/entreprises` — détail

**Filtres disponibles :** Tier, Secteur (multi-select), Account Manager. Les filtres "Statut commercial" et "Statut Digi" ont été retirés.

**Fiche entreprise (drawer) :** Les champs "Statut" (statut_entreprise) et "Statut DIGI" (statut_digi) sont affichés en lecture seule — non modifiables depuis l'UI.

---

## Règles pour Claude Code

- Avant toute implémentation complexe (nouveau schéma, Edge Function, nouvelle logique de scoring), passer en mode Plan et attendre validation
- Toute modification des règles AM → nouvelle migration SQL dans `supabase/migrations/` avec timestamp `YYYYMMDDHHMMSS_description.sql`
- Le trigger `compute_entreprise_tier_icp` et la fonction `computeTier` dans `src/lib/scoring/compute-tier.ts` doivent rester synchronisés
- Le trigger `compute_contact_scoring` et la fonction `scoreContact` dans `src/lib/scoring/score-contact.ts` doivent rester synchronisés
