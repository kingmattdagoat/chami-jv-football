
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useSave, commit } from '../game/store'
import { buyPack, claimPack } from '../game/shop'
import { PACKS } from '../game/packs'
import { RARITY_INFO, rarityOf } from '../game/cards'
import { REAL_PLAYERS, getPlayer } from '../game/data/roster'
import { earn } from '../game/economy'

export const Route = createFileRoute('/')({ component: Home })

type Tab = 'PLAY' | 'SHOP' | 'TEAM' | 'COLLECTION'
const gold = '#e8b923'
const crimson = '#9e1b32'

const panel: CSSProperties = {
  background: 'rgba(35,13,20,.94)',
  border: '1px solid #59212e',
  borderRadius: 12,
  padding: 16,
}

const btn: CSSProperties = {
  background: crimson,
  color: '#fff5dc',
  border: `1px solid ${gold}`,
  borderRadius: 8,
  padding: '11px 15px',
  fontWeight: 900,
  cursor: 'pointer',
}

const muted: CSSProperties = { color: '#c4aeb2' }

function Home() {
  const save = useSave()
  const [tab, setTab] = useState<Tab>('PLAY')
  const [notice, setNotice] = useState('')
  const [yards, setYards] = useState(0)
  const [down, setDown] = useState(1)
  const [line, setLine] = useState(20)
  const [score, setScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [plays, setPlays] = useState<string[]>([
    'WELCOME TO THE FLYERS FIELD. PICK A PLAY TO START.',
  ])
  const [packReveal, setPackReveal] = useState(false)

  const play = (kind: 'RUN' | 'PASS') => {
    const gain =
      kind === 'RUN'
        ? Math.floor(Math.random() * 9) - 1
        : Math.floor(Math.random() * 19) - 4

    const next = Math.max(0, Math.min(100, line + Math.max(-4, gain)))
    const newYards = Math.max(0, gain)

    let message =
      kind === 'RUN'
        ? `RUN PLAY: ${newYards} YARDS.`
        : `PASS PLAY: ${newYards} YARDS.`

    let d = down + 1
    let l = next
    let pts = score

    if (gain >= 0 && next >= 100) {
      message = 'TOUCHDOWN FLYERS! +7 POINTS.'
      pts += 7
      l = 20
      d = 1
      commit(draft => {
        earn(draft, 50, 'Touchdown reward')
      })
    }

    if (newYards >= 10) {
      message += ' FIRST DOWN!'
      d = 1
    } else if (d > 4) {
      message = 'TURNOVER ON DOWNS. DEFENSE HOLDS.'
      d = 1
      l = 20
      setOppScore(v => v + (Math.random() < 0.25 ? 3 : 0))
    }

    setScore(pts)
    setDown(d)
    setLine(l)
    setYards(v => v + newYards)
    setPlays(old => [message, ...old].slice(0, 7))
  }

  const startOver = () => {
    setScore(0)
    setOppScore(0)
    setYards(0)
    setDown(1)
    setLine(20)
    setPlays(['NEW EXHIBITION STARTED. LET’S FLY.'])
  }

  const buy = (id: string) => {
    const result = commit(draft => buyPack(draft, id))

    if (result.ok) {
      setTab('SHOP')
      setPackReveal(false)
      setNotice('Pack purchased! Open it below.')
    } else {
      setNotice(result.error)
    }
  }

  const claim = () => {
    const pending = save.pendingPack
    if (!pending) return

    const result = commit(draft => claimPack(draft, pending.id))

    setNotice(
      result.ok
        ? `${result.value.length} cards added to your collection!`
        : result.error,
    )
    setPackReveal(false)
  }

  const ownedIds = new Set(save.cards.map(c => c.playerId))

  const starters = save.cards
    .map(c => ({ ...c, player: getPlayer(c.playerId) }))
    .filter(c => c.player)

  const roster = [...REAL_PLAYERS].sort(
    (a, b) => b.overall - a.overall,
  )

  const cardStyle = (rarity: string): CSSProperties => ({
    border: `1px solid ${
      RARITY_INFO[rarity as keyof typeof RARITY_INFO]?.color ?? '#777'
    }`,
    background:
      'linear-gradient(145deg, rgba(255,255,255,.06), rgba(0,0,0,.3))',
    borderRadius: 10,
    padding: 12,
  })

  const nav: Tab[] = ['PLAY', 'SHOP', 'TEAM', 'COLLECTION']

  return (
    <main
      style={{
        minHeight: '100vh',
        color: '#fff5dc',
        background:
          'radial-gradient(ellipse at top, #561522 0%, #17090d 55%, #090609 100%)',
        fontFamily: 'var(--font-body, Arial, sans-serif)',
        padding: '18px 14px 40px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            borderBottom: `2px solid ${gold}`,
            paddingBottom: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                color: gold,
                fontSize: 12,
                letterSpacing: 4,
                fontWeight: 900,
              }}
            >
              CHAMINADE JV • MINEOLA, NY
            </div>
            <div
              style={{
                fontSize: 'clamp(26px,5vw,42px)',
                fontWeight: 1000,
                lineHeight: 1.1,
                marginTop: 6,
              }}
            >
              🏈 FLYERS FOOTBALL
            </div>
            <div style={muted}>PIXEL GRIDIRON • BUILD YOUR DYNASTY</div>
          </div>

          <div style={{ ...panel, minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 11, ...muted }}>COINS</div>
            <div
              style={{ color: gold, fontSize: 25, fontWeight: 1000 }}
            >
              🪙 {save.coins.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, ...muted }}>
              {save.cards.length} cards owned
            </div>
          </div>
        </header>

        <nav
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
            gap: 8,
            marginBottom: 18,
          }}
        >
          {nav.map(n => (
            <button
              key={n}
              onClick={() => {
                setTab(n)
                setNotice('')
              }}
              style={{
                ...btn,
                background: tab === n ? gold : '#281018',
                color: tab === n ? '#241016' : '#fff5dc',
                fontSize: 12,
              }}
            >
              {n === 'PLAY'
                ? '🏈 PLAY'
                : n === 'SHOP'
                  ? '🎴 SHOP'
                  : n === 'TEAM'
                    ? '🛡️ TEAM'
                    : '📚 COLLECTION'}
            </button>
          ))}
        </nav>

        {notice && (
          <div
            role="status"
            style={{ ...panel, borderColor: gold, marginBottom: 14 }}
          >
            {notice}
          </div>
        )}

        {tab === 'PLAY' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(min(100%,300px),1fr))',
              gap: 14,
            }}
          >
            <section style={panel}>
              <div
                style={{
                  color: gold,
                  fontWeight: 900,
                  letterSpacing: 2,
                  fontSize: 12,
                }}
              >
                EXHIBITION GAME
              </div>

              <h2 style={{ fontSize: 26, margin: '8px 0' }}>
                CHAMINADE FLYERS
              </h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  background: '#124b30',
                  border: '2px solid #6aaf76',
                  borderRadius: 10,
                  padding: 18,
                  margin: '14px 0',
                  backgroundImage:
                    'repeating-linear-gradient(90deg,transparent 0 48px,rgba(255,255,255,.08) 49px 51px)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 34 }}>🪽</div>
                  <b>CHAM</b>
                  <div style={{ fontSize: 36, fontWeight: 1000 }}>
                    {score}
                  </div>
                </div>

                <div style={{ color: gold, fontWeight: 900 }}>VS</div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 34 }}>🛡️</div>
                  <b>OPP</b>
                  <div style={{ fontSize: 36, fontWeight: 1000 }}>
                    {oppScore}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                <span>
                  DOWN <b style={{ color: gold }}>{down}&amp; 10</b>
                </span>
                <span>
                  BALL AT{' '}
                  <b style={{ color: gold }}>
                    {line === 100 ? 'GOAL' : `CH ${line}`}
                  </b>
                </span>
                <span>
                  YARDS <b style={{ color: gold }}>{yards}</b>
                </span>
              </div>

              <div
                style={{
                  height: 12,
                  background: '#080b09',
                  borderRadius: 99,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${line}%`,
                    background:
                      'linear-gradient(90deg,#e8b923,#f8f0b2)',
                    transition: 'width .2s',
                  }}
                />
              </div>

              <p style={muted}>
                Choose a play. Gain 10 yards for a first down, reach the end
                zone to score. This is a quick-play prototype while the full
                animated engine is wired in.
              </p>

              <div
                style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
              >
                <button
                  style={{ ...btn, flex: 1 }}
                  onClick={() => play('RUN')}
                >
                  🏃 RUN PLAY
                </button>
                <button
                  style={{ ...btn, flex: 1, background: '#17364a' }}
                  onClick={() => play('PASS')}
                >
                  🎯 PASS PLAY
                </button>
                <button
                  style={{ ...btn, background: '#24151a' }}
                  onClick={startOver}
                >
                  RESET GAME
                </button>
              </div>
            </section>

            <section style={panel}>
              <h2 style={{ marginTop: 0 }}>PLAY-BY-PLAY</h2>

              <div style={{ display: 'grid', gap: 8 }}>
                {plays.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      borderRadius: 7,
                      background: i === 0 ? '#381622' : '#1b1015',
                      borderLeft: `3px solid ${i === 0 ? gold : '#693040'}`,
                      fontWeight: i === 0 ? 800 : 500,
                    }}
                  >
                    {p}
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 18,
                  borderTop: '1px solid #59212e',
                  paddingTop: 14,
                }}
              >
                <div style={{ color: gold, fontWeight: 900 }}>
                  QUICK REWARDS
                </div>
                <p style={muted}>
                  Open packs, collect players, and build your Flyers squad.
                  Touchdowns earn 50 coins.
                </p>
                <button style={btn} onClick={() => setTab('SHOP')}>
                  GO TO PLAYER SHOP →
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'SHOP' && (
          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>PLAYER PACK SHOP</h2>
            <p style={muted}>
              Collect Flyers players across six rarity tiers. Your progress is
              saved in this browser.
            </p>

            {save.pendingPack && (
              <div
                style={{
                  ...panel,
                  borderColor: gold,
                  marginBottom: 14,
                }}
              >
                <h3 style={{ marginTop: 0 }}>🎁 PACK READY TO OPEN</h3>

                {!packReveal ? (
                  <button style={btn} onClick={() => setPackReveal(true)}>
                    RIP OPEN PACK
                  </button>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fit,minmax(125px,1fr))',
                        gap: 10,
                        margin: '12px 0',
                      }}
                    >
                      {save.pendingPack.cards.map((c, i) => {
                        const p = getPlayer(c.playerId)

                        return (
                          <div key={i} style={cardStyle(c.rarity)}>
                            <div
                              style={{
                                fontSize: 10,
                                color: RARITY_INFO[c.rarity].color,
                                fontWeight: 900,
                              }}
                            >
                              {c.rarity.toUpperCase()}
                            </div>
                            <div style={{ fontSize: 28, margin: '8px 0' }}>
                              🏈
                            </div>
                            <b>{p?.name ?? 'Mystery Player'}</b>
                            <div style={muted}>
                              #{p?.number ?? '—'} • {p?.listedPos}
                            </div>
                            <div style={{ color: gold, fontWeight: 900 }}>
                              OVR {p?.overall ?? '—'}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <button style={btn} onClick={claim}>
                      ADD CARDS TO COLLECTION
                    </button>
                  </>
                )}
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                gap: 12,
              }}
            >
              {PACKS.map(p => (
                <div
                  key={p.id}
                  style={{
                    ...panel,
                    borderColor: p.accent,
                    background: 'linear-gradient(145deg,#30121b,#12090d)',
                  }}
                >
                  <div style={{ fontSize: 32 }}>🎴</div>
                  <h3 style={{ margin: '6px 0', color: p.accent }}>
                    {p.name}
                  </h3>

                  {/* Fixed JSX syntax error in the original file */}
                  <p style={{ ...muted, minHeight: 42 }}>{p.blurb}</p>

                  <div
                    style={{ fontSize: 22, fontWeight: 1000, color: gold }}
                  >
                    🪙 {p.price.toLocaleString()}
                  </div>
                  <div
                    style={{
                      ...muted,
                      fontSize: 12,
                      margin: '6px 0 14px',
                    }}
                  >
                    {p.cards} cards per pack
                  </div>

                  <button
                    style={{
                      ...btn,
                      width: '100%',
                      opacity:
                        save.coins < p.price || !!save.pendingPack ? 0.65 : 1,
                    }}
                    disabled={save.coins < p.price || !!save.pendingPack}
                    onClick={() => buy(p.id)}
                  >
                    {save.coins < p.price
                      ? 'NOT ENOUGH COINS'
                      : save.pendingPack
                        ? 'OPEN CURRENT PACK'
                        : 'BUY PACK'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'TEAM' && (
          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>FLYERS ROSTER</h2>
            <p style={muted}>
              Roster player data from the project. Ratings are game ratings,
              not official statistics.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
                gap: 9,
              }}
            >
              {roster.map(p => (
                <div
                  key={p.id}
                  style={{
                    ...cardStyle(rarityOf(p.id)),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      background: '#5a1425',
                      border: `1px solid ${gold}`,
                      borderRadius: 8,
                      padding: 10,
                      minWidth: 48,
                      textAlign: 'center',
                      fontWeight: 1000,
                    }}
                  >
                    #{p.number ?? '—'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{p.name}</b>
                    <div style={muted}>
                      {p.listedPos} • {p.grade ?? 'Grade unavailable'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <b style={{ color: gold, fontSize: 20 }}>{p.overall}</b>
                    <div
                      style={{
                        fontSize: 10,
                        color: RARITY_INFO[rarityOf(p.id)].color,
                      }}
                    >
                      {rarityOf(p.id).toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'COLLECTION' && (
          <section style={panel}>
            <h2 style={{ marginTop: 0 }}>MY COLLECTION</h2>
            <p style={muted}>
              Owned cards: {save.cards.length} • Unique players: {ownedIds.size}
            </p>

            {starters.length === 0 ? (
              <p>No cards yet. Visit the shop to open a pack.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(165px,1fr))',
                  gap: 10,
                }}
              >
                {starters.map(c => (
                  <div
                    key={c.uid}
                    style={cardStyle(rarityOf(c.playerId))}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: RARITY_INFO[rarityOf(c.playerId)].color,
                        fontWeight: 900,
                      }}
                    >
                      {rarityOf(c.playerId).toUpperCase()}
                    </div>

                    <div style={{ fontSize: 28, margin: '8px 0' }}>🏈</div>
                    <b>{c.player?.name}</b>
                    <div style={muted}>
                      {c.player?.listedPos} • #{c.player?.number ?? '—'}
                    </div>
                    <div
                      style={{
                        color: gold,
                        fontWeight: 900,
                        marginTop: 6,
                      }}
                    >
                      OVR {(c.player?.overall ?? 0) + c.level}
                    </div>
                    {c.level > 0 && (
                      <div style={muted}>Training Lv. {c.level}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer
          style={{
            textAlign: 'center',
            ...muted,
            fontSize: 12,
            padding: '24px 0 0',
          }}
        >
          CHAMI JV FOOTBALL • LOCAL SAVE • MADE FOR FLYERS FANS
        </footer>
      </div>
    </main>
  )
}
