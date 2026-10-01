-- Le webhook Kommo resynchronisait le nom du client à chaque message reçu,
-- écrasant une correction manuelle faite dans le CRM par le pseudo
-- WhatsApp/Instagram du contact Kommo (souvent juste un prénom ou un
-- pseudo jamais mis à jour) — perte constatée le 30/09 sur 257 fiches.
-- Ce champ explicite remplace l'heuristique "2 mots ou plus" utilisée en
-- correctif d'urgence côté webhook (src/lib/kommoWebhook.ts,
-- nomSembleComplet) : dès qu'une personne modifie le nom depuis le CRM
-- (AppShell.tsx, updateClientById/addClient), ce champ passe à true et le
-- webhook ne touche plus jamais au nom de cette fiche, quel que soit ce
-- que Kommo envoie ensuite.
alter table clients
  add column if not exists nom_verrouille boolean not null default false;

-- Verrouille immédiatement les noms qui ressemblent déjà à "Prénom NOM"
-- (2 mots ou plus, hors fiches encore provisoires "Lead/Contact Kommo
-- #...") — pour ne pas attendre qu'une conseillère retouche la fiche avant
-- de protéger un nom déjà correct.
update clients
set nom_verrouille = true
where nom_verrouille = false
  and nom is not null
  and trim(nom) <> ''
  and array_length(regexp_split_to_array(trim(nom), '\s+'), 1) >= 2
  and nom not like 'Lead Kommo #%'
  and nom not like 'Contact Kommo #%';
