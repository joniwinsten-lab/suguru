import type { LevelJson } from '../game/types'
import raw01 from './level-01.json'
import raw02 from './level-02.json'
import raw03 from './level-03.json'
import raw04 from './level-04.json'
import raw05 from './level-05.json'
import { parseLevel } from '../game/level'

const raws = [raw01, raw02, raw03, raw04, raw05] as LevelJson[]

export const levels = raws.map((raw) => parseLevel(raw))

export function getLevelById(id: string) {
  return levels.find((l) => l.id === id) ?? levels[0]
}
