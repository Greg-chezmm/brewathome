/** Erreurs bloquantes d'un formulaire de recette (liste vide : on peut enregistrer). */
export function recipeFormErrors(value: { targetVolumeL: number }): string[] {
  const errors: string[] = []
  if (!Number.isFinite(value.targetVolumeL) || value.targetVolumeL <= 0) {
    errors.push('Le volume cible doit être supérieur à 0 L.')
  }
  return errors
}
