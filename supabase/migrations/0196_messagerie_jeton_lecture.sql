-- BRIEF_MESSAGERIE.md §1 ter (2026-11-06) : "Ne jamais demander de
-- coordonnées pour pouvoir répondre". Le fil se rattache désormais au
-- jeton anonyme de navigateur (le même que les favoris, voir
-- favorites-context.tsx), pour retrouver la conversation sans jamais
-- demander nom/email/téléphone avant d'envoyer. Les coordonnées restent
-- possibles, mais seulement après l'envoi et de façon facultative.
alter table messagerie_conversations
  add column if not exists jeton text not null default '';

create index if not exists messagerie_conversations_jeton_idx
  on messagerie_conversations (jeton)
  where jeton <> '';

-- Badge "réponse non lue" sur la bulle d'aide : vrai pour les messages
-- de la cliente (par défaut, sans effet), faux pour une réponse de
-- l'équipe tant que la cliente n'a pas rouvert le fil.
alter table messagerie_messages
  add column if not exists lu boolean not null default false;

update messagerie_messages set lu = true where auteur = 'client';
