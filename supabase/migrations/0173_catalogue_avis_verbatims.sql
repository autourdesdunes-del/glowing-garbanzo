-- Vraies citations d'avis clients (Google/TripAdvisor) par activité,
-- remplies manuellement par l'équipe — jamais générées automatiquement.
-- Forme : [{ "prenom": "...", "texte": "...", "source": "Google" | "TripAdvisor" }]
alter table catalogue_activites
  add column avis_verbatims jsonb not null default '[]'::jsonb;
