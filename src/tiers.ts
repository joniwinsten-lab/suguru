export const POOL_TIERS = [
  { id: 'beginner-4a', title: '4×4 — Aloittelija' },
  { id: 'easy-6', title: '6×6 — Helppo' },
  { id: 'hard-7', title: '7×7 — Vaikea' },
  { id: 'pro-8', title: '8×8 — Ammattilainen' },
  { id: 'legend-9', title: '9×9 — Legenda' },
] as const

export type PoolTierId = (typeof POOL_TIERS)[number]['id']
