// Enlève les accents/diacritiques d'une chaîne (é/è/ê/ë → e, ï → i...) pour
// que chercher "Joel" trouve "Joël", "Celia" trouve "Célia", etc. — sinon
// il faut taper l'accent exact pour qu'une recherche remonte quoi que ce
// soit. Utilisé partout où on filtre une liste de clients par nom tapé.
export function deaccent(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
