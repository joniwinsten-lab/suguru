import type { LevelJson } from '../game/types'
import raw01 from './level-01.json'
import raw02 from './level-02.json'
import { parseLevel } from '../game/level'

const raws = [raw01, raw02] as LevelJson[]

export const levels = raws.map((raw) => parseLevel(raw))

export function getLevelById(id: string) {
  return levels.find((l) => l.id === id) ?? levels[0]
}
