import type { LevelJson } from './game/types'

export type PoolPack = {
  tierId: string
  tierTitle: string
  count: number
  levels: LevelJson[]
}

const cache = new Map<string, Promise<PoolPack>>()

export function loadPool(tierId: string): Promise<PoolPack> {
  let p = cache.get(tierId)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}pools/${tierId}.json`, {
      cache: 'no-store',
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Level pack not found: ${tierId} (${r.status})`)
        return r.json() as Promise<PoolPack>
      })
      .then((pack) => {
        if (!pack.levels?.length) throw new Error(`Empty level pack: ${tierId}`)
        return pack
      })
    cache.set(tierId, p)
  }
  return p
}

export function clearPoolCache(): void {
  cache.clear()
}
