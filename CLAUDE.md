# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plusieurs sessions Claude Code tournent en parallèle sur ce dossier

Mélanie ouvre régulièrement plusieurs fenêtres Claude Code sur ce même repo en même temps. Deux incidents concrets ont déjà eu lieu à cause de ça :
- Le tableau de bord Direction a été **entièrement refait deux fois à 21h d'intervalle** par deux sessions différentes, chacune ignorant que l'autre avait déjà fait le travail (voir `git log --oneline -- src/components/DirectionView.tsx`, deux commits "Refonte du tableau de bord Direction..." consécutifs).
- Des fichiers partagés (`client-steps.tsx`, `AppShell.tsx`, `types.ts`...) sont fréquemment modifiés simultanément par plusieurs sessions.

**Avant de commencer une fonctionnalité qui touche plusieurs fichiers ou qui ressemble à une refonte** (pas un petit fix ciblé), fais :
```bash
git log --oneline -20
git log --oneline -10 -- <fichier(s) que tu prévois de toucher>
git status --short
```
— pour repérer si un travail équivalent ou en cours existe déjà (titre de commit très récent qui ressemble à ce qu'on t'a demandé, ou fichier déjà modifié et non commité par une autre session). En cas de doute, dis-le à l'utilisateur avant de te lancer plutôt que de refaire le travail à l'aveugle.

**Avant de commiter**, si `git status` montre des fichiers modifiés que tu n'as pas toi-même édités cette session, n'ajoute jamais tout avec `git add -A`/`git add .` : isole tes propres hunks (`git diff <fichier> | grep "^@@"` pour repérer tes blocs, puis `git add <fichier>` seulement si le diff est entièrement à toi, sinon extraire un `.diff` partiel et `git apply --cached`). Ne jamais écraser le travail en cours d'une autre session.

### Compte de test QA (vérification en direct dans le navigateur)

Un compte de test partagé existe pour se connecter à l'app déployée et vérifier une fonctionnalité en vrai avant de dire "c'est fait" (email `claude-test-avoir-...@example.com`, rôle `direction`) — les identifiants exacts sont dans la mémoire persistante du projet (`project_qa_test_account.md`), pas ici, pour ne pas committer un mot de passe dans le dépôt.

Mélanie a explicitement autorisé le partage de ce compte entre plusieurs sessions Claude Code, à une condition stricte : **ne jamais réinitialiser son mot de passe en premier réflexe.** Un reset invalide le mot de passe pour toute autre session qui l'utiliserait au même moment — c'est exactement la collision constatée le 2026-09-05 (une session a changé le mot de passe pendant qu'une autre était connectée, provoquant un faux 401 qui ressemblait à un bug produit).

Si la connexion échoue ou qu'une écriture renvoie 401 juste après une connexion réussie : **arrête-toi, préviens Mélanie qu'une collision est probable, ne relance pas silencieusement un nouveau mot de passe.** Si elle confirme qu'il faut le régénérer, fais-le une seule fois puis mets à jour immédiatement `project_qa_test_account.md` avec le nouveau mot de passe, pour que les sessions suivantes restent synchronisées sur la même valeur.

## What this directory actually is

This is **not** a scaffolded application yet — there is no `package.json`, no build/lint/test tooling, and no git repository. It contains two handoff documents from a prior long working session:

- [brief_reconstruction_claude_code.md](brief_reconstruction_claude_code.md) — the authoritative business/product spec. Read this first, in full, before writing any code.
- [travel_crm.jsx](travel_crm.jsx) — a working prototype (a Claude.ai "artifact") that implements the validated UX, business rules, and data model. It is a **reference for logic and UX already validated with the client**, not something to copy line-by-line into the real build.

Do not invent build/lint/test commands — none exist. The first real engineering task in this project is standing up the actual app (see "Mandate" below).

## Mandate (from the brief, section 7)

1. Stand up a real shared backend — Supabase is recommended, but the account must be created by the user (autourdesdunes@gmail.com team), not by Claude.
2. Rebuild the tool as a deployed web app (Vercel or Netlify), with simple email/password auth and **one shared workspace** for the whole team (not per-user data isolation).
3. Faithfully reproduce the business rules in brief sections 2–5 — these were validated with the client after multiple iterations and are not details to reinterpret or "improve."
4. Keep `travel_crm.jsx` as the UX reference (colors, typography, card structure, wording) — no obligation to reuse its code as-is.

`travel_crm.jsx` currently persists to `window.storage` (a Claude.ai-artifact-only API, see lines 153–178) — this will not exist in a real deployment and must be replaced by the Supabase-backed persistence layer.

## Business domain (agency: Autour des Dunes, Hurghada — francophone travel agency)

Current manual process being replaced: acquisition (Instagram/WhatsApp/TikTok/Email) → manual qualification → proposal/negotiation → info collection → Notion record → flights handled by Hossam → supplier availability by direct contact → WhatsApp copy-paste block to the Egypt team → payment (deposit + balance) → confirmation → ops → pickup → incident follow-up → post-stay (J+1 message, J+7 review request). The CRM is meant to fully replace Notion, and to let even an inexperienced employee operate without memorizing the process.

### Business rules that were previously implemented wrong (do not regress these — brief section 2)

- **Exactly one deposit stream + one single balance ("solde") per client, never per-activity.** The balance covers the whole stay and attaches to exactly one place: either the first activity where it's collected, or a dedicated hotel appointment (time, place, assigned person). Never allow multiple "balances" tied to different activities for the same client.
- **Stay total is always computed**, never hand-entered: sum over activities of (adult unit price × adults + child unit price × children + options + transfer).
- **"Horaire approximatif" (approximate time) is internal-only** and must never be shown to the client; the client only ever sees "pick-up réel" (real pickup), confirmed the evening before by the team. These are two separate fields, not one field with a visibility flag.
- **PAX is not always "adults + children."** There must be a free-text override (`paxOverride`) that replaces the computed display when filled — this is the actual internal vocabulary (e.g. "2 participants, 1 accompagnateur").
- **Card density depends on both status and view**: inside a client's file, a "Confirmée" activity shows as a minimal card (name, date, total) but with options/important-info always visible as badges without a click; "Brouillon" shows full detail with warnings. In the global "Réservations" view (all clients, by date), full detail always shows regardless of status — the minimal-confirmed treatment is scoped to the client file only, deliberately.
- **Catalogue items can be "validated"** — minimal view after (name / availability / adult, child, baby unit price), full detail behind a click.
- **The Egypt-team copy-paste block** (`Name : X` / `{n} adults` / `Hotel : X` / `Room Number : X` / `What's app : X`) lives in the "Séjour" (Stay) step, not "Paiements" — date and activity name stay hand-typed by the employee; only the client-info part is automated.

### Data model (stabilized — brief section 3, mirrored in the `EMPTY_*` factories in travel_crm.jsx)

- **Client**: contact/channel info, relationship source, status (Prospect/En négociation/Client confirmé/Perdu), stay dates, travelers, `paiements[]` (deposits only), `solde` (the single balance object with its own mode/date/paid flag/location), `reservations[]`, `remboursements[]`, `verifications[]`, post-stay flags, `billetAvion` (flight ticket sub-object for Hossam).
- **Réservation** (one activity booked for a client): dates/moment, adult/child unit prices, participants (all-travelers vs. custom subset), `paxOverride`, `options[]`, transfer, `horaireApprox` (internal) vs `pickupReel` (client-facing), included/not-included/to-prepare, `infoImportante` (internal red-flag box), `coutReel` (for margin), `photoUrl`, `statutResa` (Brouillon/Confirmée).
- **Catalogue** item: reusable activity template (name, availability, adult/child/baby unit price, target margin %, logistics fields, `valide` flag).
- **Remboursement**: amount, reason, optional link to an activity, dates, mode, who processed it, status.
- **Vérification**: simple "who checked this file and when" log entry.

### App structure (views/tabs — brief section 4, implemented as `mode` switch in `App()`, travel_crm.jsx:137)

- **Vue équipe** — client list + search; client detail as a step-based wizard, steps navigable freely with nothing lost when switching: Contact → Séjour (+ Egypt copy-block) → Billet d'avion → Activités → Paiements → Suivi.
- **Catalogue** — activity template management with validate/minimal-view behavior.
- **Suivis** — sub-tabs: RDV paiements (payment appointments, all clients), Au revoir (J+1 post-return message), Avis clients (J+7 review request), Remboursements, Billets d'avion (for Hossam). Each row is clickable to open detail and/or jump to the client file.
- **Réservations** — every activity from every client, card view grouped by date, with quick filters (Hier/Aujourd'hui/Demain/Prochainement/Ce mois-ci/Tout).
- **Aperçu client** — a simulation of what the client would see; must faithfully follow the validated `portail_client_v2.html` prototype (referenced in the brief but not present in this directory) — airline-ticket-style banner, 6-step progress tracker, accordion (Mon séjour / Mes paiements / Mes activités / Guide Égypte), upsell section from the validated catalogue, help search, and WhatsApp escape hatches.
- **Direction** — gated by a simple PIN (`DIRECTOR_PIN` in travel_crm.jsx:148 — explicitly *not* real security, just friction), revenue/margin dashboards, per-activity reference margin, top activities/clients.

### Not yet built (brief section 6 — open, not urgent)

Real per-user auth (today: shared access + PIN for Direction), the ~70 real catalogue activities (catalogue currently empty), any integration between this CRM, respond.io (WhatsApp/Instagram automations already built there), and Notion (still used in parallel), supplier availability tracking, document generation (confirmation/invoice), change history/undo, and KPIs (conversion rate by channel, response time, etc.).

## Brand system (must carry over into the real build)

Palette: terracotta/rust `#5C2A1D` / `#8B4531`, sand `#F2E6D2`, teal (Red Sea) `#0F5C56`, gold `#C9973E` (see constants at travel_crm.jsx:1482–1485). Typography: Fraunces for headings, Work Sans for body text, Space Mono for dates/amounts (loaded via Google Fonts in the `CSS` template string at travel_crm.jsx:1467).
