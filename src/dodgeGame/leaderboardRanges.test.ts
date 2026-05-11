import { describe, expect, it } from 'vitest'
import { dodgeLeaderboardDateRange } from './leaderboardRanges'

describe('dodgeLeaderboardDateRange', () => {
  it('päivä: molemmat rajat ovat sama UTC-päivä (dayKey)', () => {
    expect(dodgeLeaderboardDateRange('day', '2026-05-11', new Date('2026-05-11T12:00:00.000Z'))).toEqual({
      start: '2026-05-11',
      end: '2026-05-11',
    })
  })

  it('viikko: maanantai–sunnuntai UTC (viite keskiviikkona)', () => {
    const ref = new Date(Date.UTC(2026, 4, 6, 12, 0, 0))
    expect(dodgeLeaderboardDateRange('week', 'irrelevant', ref)).toEqual({
      start: '2026-05-04',
      end: '2026-05-10',
    })
  })

  it('kuukausi: kuun 1.–viimeinen UTC', () => {
    const ref = new Date(Date.UTC(2026, 4, 15, 0, 0, 0))
    expect(dodgeLeaderboardDateRange('month', 'irrelevant', ref)).toEqual({
      start: '2026-05-01',
      end: '2026-05-31',
    })
  })

  it('kaikki: leveä kiinteä ikkuna (yksi paras peli / nimi koko historiassa)', () => {
    expect(dodgeLeaderboardDateRange('all', 'irrelevant', new Date('2020-01-01T00:00:00.000Z'))).toEqual({
      start: '2000-01-01',
      end: '2099-12-31',
    })
  })
})
