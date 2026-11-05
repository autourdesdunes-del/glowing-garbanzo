-- Arbre de questions/réponses de la messagerie (BRIEF_MESSAGERIE.md,
-- 2026-11-05) — "des données, pas du code" : Mélanie ajoute une branche
-- depuis le CRM (Aide > Arbre d'aide), sans déploiement.
--
-- type_reponse :
--   'menu'     — regroupe des enfants, pas de réponse directe
--   'texte'    — réponse statique rédigée dans reponse_texte
--   'donnee'   — réponse résolue côté vitrine depuis les données du client
--                connecté (voir `source` : pickup/rdv/statut/inclus/
--                aprevoir/montgolfiere/solde/annulation) — jamais
--                affichée hors de l'espace client, où ces infos n'existent
--                pas encore (prospect / fiche publique).
-- `horaire_approx` n'apparaît JAMAIS comme source ici (règle métier
-- interne, voir CLAUDE.md) — seul pickup_reel (déjà confirmé) sort.
create table if not exists arbre_noeuds (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references arbre_noeuds(id) on delete cascade,
  libelle text not null default '',
  type_reponse text not null default 'texte'
    check (type_reponse in ('menu', 'texte', 'donnee')),
  source text not null default '',
  reponse_texte text not null default '',
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table arbre_noeuds enable row level security;

-- Lecture publique (anon) — c'est un arbre d'aide affiché aux visiteurs
-- du site, rien d'interne dedans.
create policy "arbre_noeuds_select_anon"
  on arbre_noeuds for select
  to anon
  using (actif = true);

create policy "arbre_noeuds_all_authenticated"
  on arbre_noeuds for all
  to authenticated
  using (true)
  with check (true);

-- Contenu de départ (brief design 2026-11-05) — modifiable ensuite depuis
-- le CRM sans redéploiement.
insert into arbre_noeuds (id, parent_id, libelle, type_reponse, source, reponse_texte, ordre) values
  ('a0000000-0000-0000-0000-000000000001', null, 'Les transferts et horaires', 'menu', '', '', 1),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Comment se passent les transferts ?', 'texte', '', 'Nos chauffeurs viennent vous chercher directement à votre hôtel et vous y ramènent à la fin de l''activité, sauf indication contraire sur la fiche. L''heure exacte de prise en charge vous est confirmée la veille au soir par notre équipe.', 1),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Pourquoi une taxe de transfert, et combien ?', 'texte', '', 'Le véhicule part toujours de Hurghada : selon la zone de votre hôtel (Sahl Hasheesh, Makadi Bay, El Gouna, Safaga, Soma Bay...), un supplément de transfert s''ajoute. Le montant exact pour votre hôtel est calculé automatiquement dans le tunnel de réservation, et le barème complet est affiché sur chaque fiche activité, section "Suppléments".', 2),
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Mon hôtel n''est pas à Hurghada, est-ce un problème ?', 'texte', '', 'Non — nous desservons aussi Sahl Hasheesh, Makadi Bay, El Gouna, Safaga et Soma Bay. Une taxe de transfert s''applique simplement selon la zone (voir la question sur la taxe de transfert).', 3),
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'À quelle heure on vient me chercher ?', 'donnee', 'pickup', '', 4),
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Où est le rendez-vous ?', 'donnee', 'rdv', '', 5),

  ('a0000000-0000-0000-0000-000000000010', null, 'Ma réservation', 'menu', '', '', 2),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000010', 'Mon excursion est-elle confirmée ?', 'donnee', 'statut', '', 1),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000010', 'Qu''est-ce qui est inclus ?', 'donnee', 'inclus', '', 2),
  ('a0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000010', 'Qu''est-ce qu''il faut prévoir ?', 'donnee', 'aprevoir', '', 3),
  ('a0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000010', 'Ma montgolfière est-elle maintenue ?', 'donnee', 'montgolfiere', '', 4),
  ('a0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000010', 'Quelles sont les conditions d''annulation ?', 'donnee', 'annulation', '', 5),

  ('a0000000-0000-0000-0000-000000000020', null, 'Paiement', 'menu', '', '', 3),
  ('a0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000020', 'Combien me reste-t-il à payer ?', 'donnee', 'solde', '', 1),
  ('a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000020', 'Quels sont les moyens et échéances de paiement ?', 'texte', '', 'Un acompte confirme la réservation, le solde se règle sur place (espèces ou carte selon l''activité) ou via un rendez-vous que notre équipe organise avec vous pendant votre séjour. Aucun paiement en ligne n''est demandé avant votre arrivée.', 2)
on conflict (id) do nothing;
