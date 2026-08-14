-- Détection de doublon côté webhook Kommo : contrairement à la création
-- manuelle (QuickAddClient), Kommo ne matche que par kommo_lead_id,
-- téléphone ou email — jamais par nom (trop risqué de rapprocher deux
-- personnes différentes sans validation humaine). Quand aucun de ces
-- signaux ne suffit et qu'un nom proche existe déjà, on crée quand même la
-- fiche (ne jamais bloquer la synchro) mais on la marque à vérifier —
-- consommé par DoublonPossibleAlert (pop-up) et le dashboard.
alter table clients add column if not exists doublon_possible_id uuid references clients(id) on delete set null;
alter table clients add column if not exists doublon_traite boolean not null default false;

notify pgrst, 'reload schema';
