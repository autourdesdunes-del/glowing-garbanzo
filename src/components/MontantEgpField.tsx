"use client";

import { Field } from "@/components/Field";

function euros(n: number) {
  return (Number(n) || 0).toLocaleString("fr-FR");
}

// Champ "Taux (1€ =) / Montant (EGP)" réutilisé partout où un montant peut
// être réglé en espèces égyptiennes (acompte, étape libre, solde à
// l'activité) — évite d'obliger à convertir de tête avant de taper un
// chiffre dans un champ "(€)".
//
// Deux façons de s'en servir selon lequel des deux nombres est la vraie
// valeur de référence à cet endroit précis :
// - par défaut, montantEur est la valeur qu'on cherche à déterminer :
//   modifier le taux ou le montant EGP recalcule montantEur (via
//   onMontantEurChange) — cas de l'acompte et des étapes libres.
// - avec lockedMontantEur, montantEur est déjà fixé ailleurs (ex. le solde
//   dû) et ne bouge pas : modifier le montant EGP recalcule alors le TAUX
//   (via onRateChange) plutôt que montantEur — cas du solde réglé à
//   l'activité, où seul le taux reste à préciser pour la traçabilité.
export default function MontantEgpField({
  rate,
  onRateChange,
  montantEur,
  onMontantEurChange,
  lockedMontantEur = false,
}: {
  rate: number;
  onRateChange: (rate: number) => void;
  montantEur: number;
  onMontantEurChange?: (montantEur: number) => void;
  lockedMontantEur?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Taux (1€ =)">
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={(e) => onRateChange(Number(e.target.value))}
          className="input"
        />
      </Field>
      <Field label={lockedMontantEur ? "Montant total (EGP)" : "Montant (EGP)"}>
        <input
          type="number"
          value={rate > 0 ? Math.round(montantEur * rate) : ""}
          onChange={(e) => {
            const montantEgp = Number(e.target.value);
            if (lockedMontantEur) {
              if (montantEur > 0) onRateChange(montantEgp / montantEur);
            } else if (rate > 0) {
              // Arrondi aux centimes ici, une bonne fois pour toutes — sans
              // ça chaque appelant devait penser à le faire lui-même (vécu :
              // l'acompte affichait "16,892 €" au lieu de "16,89 €").
              onMontantEurChange?.(Math.round((montantEgp / rate) * 100) / 100);
            }
          }}
          className="input"
        />
      </Field>
      {!lockedMontantEur && (
        <p className="col-span-2 text-xs text-neutral-500">Soit {euros(montantEur)} € au taux du jour.</p>
      )}
    </div>
  );
}
