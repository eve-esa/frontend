// Decides whether a terminal stream error deserves an error toast. A turn
// whose stream already painted a visible partial answer must fail quietly:
// the partial stays in the bubble and the persisted truth (metadata.error)
// arrives with the reconcile refetch, while a red failure toast next to a
// half-answer reads as two contradictory verdicts on the same turn. Only
// turns that produced nothing visible toast, because there the toast is the
// sole signal that anything happened at all.
export function shouldToastStreamError(accumulatedOutput: string): boolean {
  return accumulatedOutput.trim().length === 0;
}
