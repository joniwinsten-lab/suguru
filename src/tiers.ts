export const POOL_TIERS = [
  { id: 'beginner-4a', title: '4×4 — Beginner' },
  { id: 'easy-6', title: '6×6 — Easy' },
  { id: 'hard-7', title: '7×7 — Hard' },
  { id: 'pro-8', title: '8×8 — Pro' },
  { id: 'legend-9', title: '9×9 — Legend' },
] as const

export type PoolTierId = (typeof POOL_TIERS)[number]['id']
