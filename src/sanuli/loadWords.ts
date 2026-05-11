export type FiWordPack = {
  solutions: string[]
  allowed: string[]
}

let cache: Promise<FiWordPack> | null = null

export function loadFiWords(): Promise<FiWordPack> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}words/fi-5.json`)
      .then((r) => {
        if (!r.ok)
          throw new Error(`Word list not found (${r.status})`)
        return r.json() as Promise<{ solutions?: string[]; allowed?: string[] }>
      })
      .then((raw) => {
        const solutions = raw.solutions
        const allowed = raw.allowed
        if (!solutions?.length || !allowed?.length)
          throw new Error('Word list is empty or invalid')
        return { solutions, allowed }
      })
  }
  return cache
}

export function clearFiWordsCache(): void {
  cache = null
}
