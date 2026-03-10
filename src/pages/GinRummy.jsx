import { useState, useCallback } from 'react'

// ── Deck helpers ──────────────────────────────────────────────
const SUITS = ['♠', '♣', '♥', '♦']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_IDX = Object.fromEntries(RANKS.map((r, i) => [r, i]))
const cardValue = r => r === 'A' ? 1 : ['J', 'Q', 'K'].includes(r) ? 10 : parseInt(r)
const isRed = s => s === '♥' || s === '♦'

function makeDeck() {
  const deck = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ id: `${rank}${suit}`, rank, suit, value: cardValue(rank) })
  return deck
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Meld detection ────────────────────────────────────────────
function findSets(hand) {
  const byRank = {}
  for (const c of hand) (byRank[c.rank] ??= []).push(c)
  const sets = []
  for (const cards of Object.values(byRank))
    if (cards.length >= 3) {
      sets.push(cards.slice(0, 3))
      if (cards.length === 4) sets.push(cards.slice(0, 4))
    }
  return sets
}

function findRuns(hand) {
  const bySuit = {}
  for (const c of hand) (bySuit[c.suit] ??= []).push(c)
  const runs = []
  for (const cards of Object.values(bySuit)) {
    const sorted = [...cards].sort((a, b) => RANK_IDX[a.rank] - RANK_IDX[b.rank])
    let i = 0
    while (i < sorted.length) {
      let j = i + 1
      while (j < sorted.length && RANK_IDX[sorted[j].rank] === RANK_IDX[sorted[j - 1].rank] + 1) j++
      if (j - i >= 3) {
        for (let len = 3; len <= j - i; len++)
          runs.push(sorted.slice(i, i + len))
      }
      i = j
    }
  }
  return runs
}

function bestMelds(hand) {
  // Greedy: try all sets then runs, pick combo with lowest deadwood
  const allMelds = [...findSets(hand), ...findRuns(hand)]
  let best = { melds: [], deadwood: [...hand] }
  let bestDW = hand.reduce((s, c) => s + c.value, 0)

  function search(remaining, chosen, usedIds) {
    const dw = remaining.reduce((s, c) => s + c.value, 0)
    if (dw < bestDW) { bestDW = dw; best = { melds: chosen, deadwood: remaining } }
    for (const meld of allMelds) {
      if (meld.some(c => usedIds.has(c.id))) continue
      const newUsed = new Set([...usedIds, ...meld.map(c => c.id)])
      const newRem = remaining.filter(c => !newUsed.has(c.id))
      search(newRem, [...chosen, meld], newUsed)
    }
  }
  search(hand, [], new Set())
  return { ...best, deadwoodValue: bestDW }
}

// ── Computer AI ───────────────────────────────────────────────
function computerDraw(hand, discardTop) {
  // Take discard if it reduces deadwood
  if (discardTop) {
    const withDiscard = [...hand, discardTop]
    const { deadwoodValue: dw1 } = bestMelds(withDiscard)
    const { deadwoodValue: dw2 } = bestMelds(hand)
    if (dw1 < dw2) return 'discard'
  }
  return 'stock'
}

function computerDiscard(hand) {
  // Discard card whose removal minimizes deadwood increase
  let bestCard = null, bestDW = Infinity
  for (const card of hand) {
    const rest = hand.filter(c => c.id !== card.id)
    const { deadwoodValue: dw } = bestMelds(rest)
    if (dw < bestDW) { bestDW = dw; bestCard = card }
  }
  return bestCard
}

// ── Initial game state ────────────────────────────────────────
function dealGame() {
  const deck = shuffle(makeDeck())
  const playerHand = deck.slice(0, 10)
  const computerHand = deck.slice(10, 20)
  const stock = deck.slice(21)
  const discard = [deck[20]]
  return { playerHand, computerHand, stock, discard, scores: { player: 0, computer: 0 } }
}

// ── Card component ────────────────────────────────────────────
function Card({ card, faceDown, selected, meld, newCard, onClick, small }) {
  const sz = small ? { w: 44, h: 62, fs: 11 } : { w: 58, h: 82, fs: 14 }
  if (faceDown) return (
    <div onClick={onClick} style={{
      width: sz.w, height: sz.h, borderRadius: 6, flexShrink: 0,
      background: 'repeating-linear-gradient(45deg,#1a1a2e,#1a1a2e 3px,#2d2d4e 3px,#2d2d4e 6px)',
      border: '2px solid #1a1a2e', cursor: onClick ? 'pointer' : 'default',
    }} />
  )
  const red = isRed(card.suit)
  return (
    <div onClick={onClick} style={{
      width: sz.w, height: sz.h, borderRadius: 6, flexShrink: 0,
      background: selected ? '#fef9c3' : newCard ? '#eff6ff' : meld ? '#dcfce7' : 'white',
      border: `2px solid ${selected ? '#f59e0b' : newCard ? '#3b82f6' : meld ? '#22c55e' : '#d4d0c8'}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '3px 4px', cursor: onClick ? 'pointer' : 'default',
      boxShadow: selected ? '0 0 0 2px #f59e0b40' : '0 1px 3px rgba(0,0,0,0.1)',
      transition: 'all 0.1s',
    }}>
      <div style={{ fontSize: sz.fs, fontWeight: 700, color: red ? '#e63946' : '#1a1a2e', lineHeight: 1 }}>
        {card.rank}<br/>{card.suit}
      </div>
      <div style={{ fontSize: sz.fs, fontWeight: 700, color: red ? '#e63946' : '#1a1a2e', lineHeight: 1, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
        {card.rank}<br/>{card.suit}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function GinRummy() {
  const [game, setGame] = useState(() => dealGame())
  const [selected, setSelected] = useState(null)       // card id selected for discard
  const [phase, setPhase] = useState('draw')            // draw | discard | computer | result
  const [drawnCardId, setDrawnCardId] = useState(null) // highlights the just-drawn card
  const [message, setMessage] = useState('Draw a card to start!')
  const [roundResult, setRoundResult] = useState(null)

  const { playerHand, computerHand, stock, discard, scores } = game
  const { melds: playerMelds, deadwoodValue: playerDW } = bestMelds(playerHand)
  const meldedIds = new Set(playerMelds.flat().map(c => c.id))

  // ── Actions ─────────────────────────────────────────────────
  function drawCard(from) {
    if (phase !== 'draw') return
    let drawn, newStock = [...stock], newDiscard = [...discard]
    if (from === 'stock') {
      if (!newStock.length) { newStock = shuffle(newDiscard.slice(0, -1)); newDiscard = [newDiscard.at(-1)] }
      drawn = newStock.pop()
    } else {
      drawn = newDiscard.pop()
    }
    setGame(g => ({ ...g, playerHand: [...g.playerHand, drawn], stock: newStock, discard: newDiscard }))
    setDrawnCardId(drawn.id)
    setPhase('discard')
    setMessage('Select a card to discard.')
  }

  function selectCard(cardId) {
    if (phase !== 'discard') return
    setSelected(prev => prev === cardId ? null : cardId)
  }

  function doDiscard() {
    if (!selected || phase !== 'discard') return
    const card = playerHand.find(c => c.id === selected)
    const newHand = playerHand.filter(c => c.id !== selected)
    const newDiscard = [...discard, card]
    setSelected(null)
    setDrawnCardId(null)
    setGame(g => ({ ...g, playerHand: newHand, discard: newDiscard }))
    setPhase('computer')
    setMessage('Computer is thinking...')
    setTimeout(() => doComputerTurn(newHand, newDiscard, game.stock), 800)
  }

  function doKnock(isGin = false) {
    if (phase !== 'discard') return
    // If gin, discard selected card first (or don't if 11-card gin)
    let finalHand = playerHand
    let finalDiscard = discard
    if (selected && !isGin) {
      const card = playerHand.find(c => c.id === selected)
      finalHand = playerHand.filter(c => c.id !== selected)
      finalDiscard = [...discard, card]
    }
    resolveKnock(finalHand, computerHand, scores, isGin)
  }

  const doComputerTurn = useCallback((pHand, dPile, sPile) => {
    const discardTop = dPile.at(-1)
    const drawFrom = computerDraw(computerHand, discardTop)
    let newStock = [...sPile], newDiscard = [...dPile], newCompHand = [...computerHand]

    if (drawFrom === 'discard') {
      newCompHand.push(newDiscard.pop())
    } else {
      if (!newStock.length) { newStock = shuffle(newDiscard.slice(0, -1)); newDiscard = [newDiscard.at(-1)] }
      newCompHand.push(newStock.pop())
    }

    const discarded = computerDiscard(newCompHand)
    newCompHand = newCompHand.filter(c => c.id !== discarded.id)
    newDiscard.push(discarded)

    const { deadwoodValue: compDW } = bestMelds(newCompHand)

    setGame(g => ({ ...g, computerHand: newCompHand, stock: newStock, discard: newDiscard }))

    if (compDW <= 10) {
      setTimeout(() => resolveKnock(pHand, newCompHand, scores, false, true), 400)
    } else {
      setPhase('draw')
      setMessage('Your turn! Draw a card.')
    }
  }, [computerHand, scores])

  function resolveKnock(pHand, cHand, sc, isGin, compKnocked = false) {
    const { deadwoodValue: pDW } = bestMelds(pHand)
    const { deadwoodValue: cDW } = bestMelds(cHand)

    let delta = 0, msg = ''
    if (compKnocked) {
      if (pDW <= cDW) { delta = 10 + (cDW - pDW); msg = `Undercut! You score ${delta} pts.`; sc = { ...sc, player: sc.player + delta } }
      else { delta = cDW - pDW; msg = `Computer knocked (${cDW} DW). Computer scores ${delta} pts.`; sc = { ...sc, computer: sc.computer + delta } }
    } else if (isGin || pDW === 0) {
      delta = 25 + cDW; msg = `Gin! You score ${delta} pts (25 bonus + ${cDW}).`; sc = { ...sc, player: sc.player + delta }
    } else {
      if (cDW <= pDW) { delta = 10 + (pDW - cDW); msg = `Undercut! Computer scores ${delta} pts.`; sc = { ...sc, computer: sc.computer + delta } }
      else { delta = cDW - pDW; msg = `You knocked (${pDW} DW). You score ${delta} pts.`; sc = { ...sc, player: sc.player + delta } }
    }

    setRoundResult({ msg, playerHand: pHand, computerHand: cHand, pDW, cDW })
    setGame(g => ({ ...g, scores: sc, playerHand: pHand, computerHand: cHand }))
    setPhase('result')
    setMessage(msg)
  }

  function nextRound() {
    if (game.scores.player >= 100 || game.scores.computer >= 100) {
      const newGame = dealGame()
      setGame(g => ({ ...newGame, scores: { player: 0, computer: 0 } }))
    } else {
      const newGame = dealGame()
      setGame(g => ({ ...newGame, scores: game.scores }))
    }
    setPhase('draw')
    setMessage('New round! Draw a card.')
    setRoundResult(null)
    setSelected(null)
    setDrawnCardId(null)
  }

  // Sort hand into 4 suit rows: ♠ ♣ ♥ ♦, each A→K
  function sortedBySuit(hand) {
    return SUITS.map(suit => ({
      suit,
      cards: hand
        .filter(c => c.suit === suit)
        .sort((a, b) => RANK_IDX[a.rank] - RANK_IDX[b.rank]),
    })).filter(row => row.cards.length > 0)
  }

  const canKnock = phase === 'discard' && playerDW <= 10
  const canGin = phase === 'discard' && playerHand.length === 11 && playerDW === 0

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      {/* Header */}
      <header className="border-b border-ink/10 bg-canvas px-4 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="#/" className="text-ink/50 hover:text-accent text-sm font-medium">← Back</a>
            <h1 className="font-display text-xl font-bold text-ink">Gin Rummy</h1>
          </div>
          <div className="text-sm font-medium text-ink/70">
            You <span className="text-accent font-bold">{scores.player}</span>
            {' '}·{' '}
            <span className="font-bold">{scores.computer}</span> Computer
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">
        {/* Computer hand */}
        <div>
          <div className="text-xs text-ink/40 uppercase tracking-wider mb-2">Computer — {computerHand.length} cards</div>
          <div className="flex flex-wrap gap-1.5">
            {(roundResult ? roundResult.computerHand : computerHand).map((c, i) => (
              <Card key={c.id} card={c} faceDown={!roundResult} small />
            ))}
          </div>
          {roundResult && <div className="text-xs text-ink/50 mt-1">Deadwood: {roundResult.cDW}</div>}
        </div>

        {/* Stock + Discard */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-ink/40 uppercase tracking-wider">Stock ({stock.length})</div>
            {stock.length > 0
              ? <Card faceDown onClick={() => drawCard('stock')} />
              : <div className="w-14 h-20 rounded-lg border-2 border-dashed border-ink/20 flex items-center justify-center text-ink/20 text-xs">Empty</div>
            }
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-ink/40 uppercase tracking-wider">Discard</div>
            {discard.length > 0
              ? <Card card={discard.at(-1)} onClick={phase === 'draw' ? () => drawCard('discard') : undefined} />
              : <div className="w-14 h-20 rounded-lg border-2 border-dashed border-ink/20" />
            }
          </div>
          <div className="flex-1 bg-canvas rounded-xl p-3 text-sm text-ink/70">
            {message}
          </div>
        </div>

        {/* Player hand — 4 suit rows, A→K */}
        <div>
          <div className="text-xs text-ink/40 uppercase tracking-wider mb-2">
            Your hand — Deadwood: <span className="text-ink font-bold">{playerDW}</span>
            {playerHand.length === 11 && <span className="text-accent ml-2">← select card to discard</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            {sortedBySuit(playerHand).map(({ suit, cards }) => (
              <div key={suit} className="flex gap-1.5 items-center">
                <span className={`text-xs w-4 shrink-0 font-bold ${isRed(suit) ? 'text-red-500' : 'text-ink/50'}`}>{suit}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {cards.map(c => (
                    <Card
                      key={c.id}
                      card={c}
                      selected={selected === c.id}
                      meld={meldedIds.has(c.id) && selected !== c.id}
                      newCard={drawnCardId === c.id}
                      onClick={() => selectCard(c.id)}
                      small
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        {phase === 'discard' && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={doDiscard}
              disabled={!selected}
              className="px-6 py-2 bg-ink text-paper font-medium rounded-lg disabled:opacity-40 hover:bg-ink/80 transition-colors"
            >
              Discard selected
            </button>
            {canKnock && (
              <button
                onClick={() => doKnock(false)}
                className="px-6 py-2 bg-accent text-paper font-medium rounded-lg hover:bg-accent/80 transition-colors"
              >
                Knock ({playerDW} DW)
              </button>
            )}
            {canGin && (
              <button
                onClick={() => doKnock(true)}
                className="px-6 py-2 bg-green-600 text-paper font-medium rounded-lg hover:bg-green-500 transition-colors"
              >
                Gin! 🎉
              </button>
            )}
          </div>
        )}

        {/* Round result */}
        {phase === 'result' && roundResult && (
          <div className="bg-canvas rounded-xl p-4 border border-ink/10">
            <p className="font-medium text-ink mb-3">{roundResult.msg}</p>
            <p className="text-sm text-ink/60 mb-4">
              Score: You {scores.player} · Computer {scores.computer}
              {(scores.player >= 100 || scores.computer >= 100) && (
                <span className="ml-2 font-bold text-accent">
                  {scores.player >= 100 ? '🎉 You win the game!' : '😔 Computer wins the game!'}
                </span>
              )}
            </p>
            <button
              onClick={nextRound}
              className="px-6 py-2 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors"
            >
              {scores.player >= 100 || scores.computer >= 100 ? 'New Game' : 'Next Round'}
            </button>
          </div>
        )}

        {/* Meld legend */}
        <div className="text-xs text-ink/40 flex gap-4 flex-wrap">
          <span><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-400 mr-1" />Melded</span>
          <span><span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-400 mr-1" />Selected</span>
          <span><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-400 mr-1" />Just drawn</span>
        </div>
      </main>
    </div>
  )
}
