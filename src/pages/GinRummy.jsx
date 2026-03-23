import { useState, useCallback, useEffect, useRef } from 'react'

const LS_KEY = 'gin-rummy-save'
const LS_STATS_KEY = 'gin-rummy-stats'
function loadSave() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
}
function clearSave() { localStorage.removeItem(LS_KEY) }
function loadStats() {
  try { return JSON.parse(localStorage.getItem(LS_STATS_KEY)) ?? { gamesWon:0, gamesLost:0, roundsWon:0, roundsLost:0 } }
  catch { return { gamesWon:0, gamesLost:0, roundsWon:0, roundsLost:0 } }
}
function saveStats(s) { localStorage.setItem(LS_STATS_KEY, JSON.stringify(s)) }

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
  for (const cards of Object.values(byRank)) {
    if (cards.length >= 3) {
      // Generate all C(n,3) combinations so any card can be left free for runs
      for (let i = 0; i < cards.length - 2; i++)
        for (let j = i + 1; j < cards.length - 1; j++)
          for (let k = j + 1; k < cards.length; k++)
            sets.push([cards[i], cards[j], cards[k]])
      // Also allow the full 4-card set when available
      if (cards.length === 4)
        sets.push([...cards])
    }
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
      // Generate ALL sub-runs (any start, any length ≥ 3) within this consecutive block
      // e.g. 6♥7♥8♥9♥ → [6,7,8], [6,7,8,9], [7,8,9] — so 7,8,9 can free 6♥ for a set
      if (j - i >= 3) {
        for (let start = i; start <= j - 3; start++) {
          for (let len = 3; len <= j - start; len++) {
            runs.push(sorted.slice(start, start + len))
          }
        }
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
function computerDraw(hand, discardTop, difficulty) {
  if (!discardTop) return "stock"
  const withDiscard = [...hand, discardTop]
  const dw1 = bestMelds(withDiscard).deadwoodValue
  const dw2 = bestMelds(hand).deadwoodValue
  const improvement = dw2 - dw1
  if (difficulty === "easy") return improvement > 0 ? "discard" : "stock"
  if (difficulty === "medium") return improvement >= 3 ? "discard" : "stock"
  // hard: only take if it completes a meld (improvement >= 6)
  return improvement >= 6 ? "discard" : "stock"
}

function computerDiscard(hand, difficulty, discardPile) {
  // Always pick the card whose removal minimizes remaining deadwood
  let bestCard = null, bestDW = Infinity
  for (const card of hand) {
    const rest = hand.filter(c => c.id !== card.id)
    const { deadwoodValue: dw } = bestMelds(rest)
    if (dw < bestDW) { bestDW = dw; bestCard = card }
  }
  if (difficulty !== "hard") return bestCard

  // Hard: among deadwood candidates, prefer "safe" discards
  // (cards whose rank or adjacent same-suit rank is already in discard pile = dead)
  const { deadwood } = bestMelds(hand)
  const deadRanks = new Set(discardPile.map(c => c.rank))
  const safeDeadwood = deadwood.filter(card => {
    const ri = RANK_IDX[card.rank]
    // safe if same rank already discarded, or both adjacent same-suit cards are gone
    if (deadRanks.has(card.rank)) return true
    const adjLow = RANKS[ri - 1]
    const adjHigh = RANKS[ri + 1]
    const lowGone = !adjLow || discardPile.some(c => c.rank === adjLow && c.suit === card.suit)
    const highGone = !adjHigh || discardPile.some(c => c.rank === adjHigh && c.suit === card.suit)
    return lowGone && highGone
  })
  if (safeDeadwood.length > 0) {
    // Among safe deadwood, discard highest value
    return safeDeadwood.sort((a, b) => b.value - a.value)[0]
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
  return { playerHand, computerHand, stock, discard, scores: { player: 0, computer: 0 }, reshuffleCount: 0 }
}

// ── Meld color palette ────────────────────────────────────────
const MELD_COLORS = [
  { bg: '#dcfce7', border: '#16a34a', shadow: '#16a34a50' },
  { bg: '#ccfbf1', border: '#0d9488', shadow: '#0d948850' },
  { bg: '#f3e8ff', border: '#9333ea', shadow: '#9333ea50' },
  { bg: '#ffedd5', border: '#ea580c', shadow: '#ea580c50' },
]

// ── Card component ────────────────────────────────────────────
function Card({ card, faceDown, selected, meldColor, newCard, discarding, onClick, small }) {
  const sz = small ? { w: 44, h: 62, fs: 11 } : { w: 58, h: 82, fs: 14 }
  if (faceDown) return (
    <div onClick={onClick} style={{
      width: sz.w, height: sz.h, borderRadius: 6, flexShrink: 0,
      background: 'repeating-linear-gradient(45deg,#1a1a2e,#1a1a2e 3px,#2d2d4e 3px,#2d2d4e 6px)',
      border: '2px solid #1a1a2e', cursor: onClick ? 'pointer' : 'default',
    }} />
  )
  const red = isRed(card.suit)
  const bg = selected ? '#fef9c3' : newCard ? '#fff7ed' : meldColor ? meldColor.bg : 'white'
  const borderCol = selected ? '#f59e0b' : newCard ? '#d97706' : meldColor ? meldColor.border : '#d4d0c8'
  const shadow = selected ? '0 0 0 3px #f59e0b50' : newCard ? '0 0 6px 2px #d9770660' : meldColor ? `0 0 6px 2px ${meldColor.shadow}` : '0 1px 3px rgba(0,0,0,0.1)'
  const liftY = selected ? -8 : 0
  return (
    <div onClick={onClick} style={{
      width: sz.w, height: sz.h, borderRadius: 6, flexShrink: 0,
      background: bg, border: `2px solid ${borderCol}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '3px 4px', cursor: onClick ? 'pointer' : 'default',
      boxShadow: shadow,
      transform: `translateY(${liftY}px)`,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.1s',
      animation: discarding ? 'discardOut 0.18s ease-in both' : newCard ? 'dealIn 0.22s ease-out both' : undefined,
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

// ── FlyingCard — card that animates between two screen positions ──────────────
function FlyingCard({ card, fromRect, toRect, faceDown }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const dx = (toRect.left + toRect.width  / 2) - (fromRect.left + fromRect.width  / 2)
    const dy = (toRect.top  + toRect.height / 2) - (fromRect.top  + fromRect.height / 2)
    el.style.transition = 'none'
    el.style.transform = 'translate(0,0) scale(1)'
    el.style.opacity = '1'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.1s 0.22s'
      el.style.transform = `translate(${dx}px,${dy}px) scale(0.85)`
      el.style.opacity = '0'
    }))
  }, [])
  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: fromRect.left + (fromRect.width  - (faceDown ? 58 : 58)) / 2,
      top:  fromRect.top  + (fromRect.height - (faceDown ? 82 : 82)) / 2,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      <Card card={card} faceDown={faceDown} />
    </div>
  )
}

// ── HandSummary — compact meld clusters + deadwood (used at round end) ───────
function HandSummary({ hand }) {
  const { melds, deadwood } = bestMelds(hand)
  const STEP = 20
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {melds.map((meld, mi) => {
        const color = MELD_COLORS[mi % MELD_COLORS.length]
        const w = STEP * (meld.length - 1) + 44
        return (
          <div key={mi} style={{ position: 'relative', width: w, height: 62, flexShrink: 0 }}>
            {meld.map((card, ci) => (
              <div key={card.id} style={{ position: 'absolute', left: ci * STEP, zIndex: ci + 1 }}>
                <Card card={card} meldColor={color} small />
              </div>
            ))}
          </div>
        )
      })}
      {melds.length > 0 && deadwood.length > 0 && (
        <div style={{ width: 1, height: 62, background: 'rgba(0,0,0,0.12)', flexShrink: 0 }} />
      )}
      {[...deadwood]
        .sort((a, b) => b.value - a.value)
        .map(card => <Card key={card.id} card={card} small />)
      }
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function GinRummy() {
  const _save = loadSave()
  const [game, setGame] = useState(() => _save?.game ?? dealGame())
  const [selected, setSelected] = useState(null)       // card id selected for discard — don't persist
  // If saved mid-computer-turn (setTimeout lost on reload), reset to 'draw'
  const [phase, setPhase] = useState(() => {
    const p = _save?.phase ?? 'draw'
    return p === 'computer' ? 'draw' : p
  })
  const [drawnCardId, setDrawnCardId] = useState(null)   // visual only — don't persist
  const [discardingId, setDiscardingId] = useState(null) // card mid-discard-animation
  const [flyingCards, setFlyingCards] = useState([])     // flying card overlays

  // Refs for card-flight source/destination
  const stockRef       = useRef(null)
  const discardPileRef = useRef(null)
  const playerHandRef  = useRef(null)
  const compHandRef    = useRef(null)
  const cardEls        = useRef({})   // card.id → wrapper DOM element

  // Calculate expected screen rect of a card in the player's suit-row layout
  function getCardRect(card, hand) {
    const wrapper = cardEls.current[card.id]
    if (wrapper) return wrapper.getBoundingClientRect()
    // Fallback: estimate position from layout constants
    if (!playerHandRef.current) return null
    const container = playerHandRef.current.getBoundingClientRect()
    const suitsPresent = SUITS.filter(s => hand.some(c => c.suit === s))
    const rowIdx  = suitsPresent.indexOf(card.suit)
    if (rowIdx === -1) return null
    const STEP = 23, ROW_H = 70, LABEL_W = 22
    return {
      left: container.left + LABEL_W + RANK_IDX[card.rank] * STEP,
      top:  container.top  + rowIdx * ROW_H,
      width: 44, height: 62,
    }
  }

  function triggerFly(card, fromRef, toRef, faceDown, delay = 0) {
    const fromEl = fromRef?.current
    const toEl   = toRef?.current
    if (!fromEl || !toEl) return
    const id = Date.now() + Math.random()
    const fly = () => {
      setFlyingCards(fc => [...fc, {
        id, card, faceDown,
        fromRect: fromEl.getBoundingClientRect(),
        toRect:   toEl.getBoundingClientRect(),
      }])
      setTimeout(() => setFlyingCards(fc => fc.filter(f => f.id !== id)), 400)
    }
    if (delay) setTimeout(fly, delay)
    else fly()
  }
  const [message, setMessage] = useState(() => {
    const m = _save?.message ?? 'Draw a card to start!'
    return _save?.phase === 'computer' ? 'Draw a card to start!' : m
  })
  const [roundResult, setRoundResult] = useState(() => _save?.roundResult ?? null)
  const [showHelp, setShowHelp] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showCounting, setShowCounting] = useState(false)
  const [stats, setStats] = useState(() => loadStats())
  // 'home' = landing page, 'playing' = in-game
  const [screen, setScreen] = useState(() => _save ? 'playing' : 'home')
  const [cardCounting, setCardCounting] = useState(() => _save?.cardCounting ?? false)
  // Per-round tracking (not persisted)
  const [discardHistory, setDiscardHistory] = useState(new Set()) // all card ids ever discarded
  const [compPickedIds, setCompPickedIds] = useState(new Set())   // comp drew these from discard
  const [difficulty, setDifficulty] = useState(() => _save?.difficulty ?? 'medium')
  const [targetScore, setTargetScore] = useState(() => _save?.targetScore ?? 100)

  // Persist game state to localStorage on every meaningful change
  useEffect(() => {
    if (screen !== 'playing') return  // don't save while not in game
    localStorage.setItem(LS_KEY, JSON.stringify({
      game, phase, message, roundResult, difficulty, targetScore, cardCounting
    }))
  }, [game, phase, message, roundResult, difficulty, targetScore, screen])

  const { playerHand, computerHand, stock, discard, scores } = game
  const { melds: playerMelds, deadwood: playerDeadwood, deadwoodValue: playerDW } = bestMelds(playerHand)
  const meldedIds = new Set(playerMelds.flat().map(c => c.id))
  // Assign a distinct color to each meld group
  const cardMeldColor = {}
  playerMelds.forEach((meld, mi) => {
    const color = MELD_COLORS[mi % MELD_COLORS.length]
    meld.forEach(c => { cardMeldColor[c.id] = color })
  })

  // ── Actions ─────────────────────────────────────────────────
  function drawCard(from) {
    if (phase !== 'draw') return
    let drawn, newStock = [...stock], newDiscard = [...discard]
    if (from === 'stock') {
      if (!newStock.length) {
        if ((game.reshuffleCount ?? 0) >= 1) { triggerShowdown(); return }
        newStock = shuffle(newDiscard.slice(0, -1)); newDiscard = [newDiscard.at(-1)]
        setGame(g => ({ ...g, reshuffleCount: (g.reshuffleCount ?? 0) + 1, stock: newStock, discard: newDiscard }))
      }
      drawn = newStock.pop()
    } else {
      drawn = newDiscard.pop()
    }
    // Fly: pile → exact card position in hand
    const newHand = [...playerHand, drawn]
    const toRect = getCardRect(drawn, newHand)
    const fromEl = (from === 'stock' ? stockRef : discardPileRef).current
    if (fromEl && toRect) {
      const id = Date.now() + Math.random()
      setFlyingCards(fc => [...fc, {
        id, card: drawn, faceDown: from === 'stock',
        fromRect: fromEl.getBoundingClientRect(),
        toRect,
      }])
      setTimeout(() => setFlyingCards(fc => fc.filter(f => f.id !== id)), 400)
    }
    setGame(g => ({ ...g, playerHand: [...g.playerHand, drawn], stock: newStock, discard: newDiscard }))
    setDrawnCardId(drawn.id)
    setPhase('discard')
    setMessage('Select a card to discard.')
  }

  function selectCard(cardId) {
    if (phase !== 'discard') return
    if (selected === cardId) {
      doDiscard()   // second tap = discard immediately
    } else {
      setSelected(cardId)
    }
  }

  function doDiscard() {
    if (!selected || phase !== 'discard') return
    const card = playerHand.find(c => c.id === selected)
    // Fly card from exact card position → discard pile
    const cardFromEl = cardEls.current[selected]
    const toEl = discardPileRef.current
    if (cardFromEl && toEl) {
      const id = Date.now() + Math.random()
      setFlyingCards(fc => [...fc, {
        id, card, faceDown: false,
        fromRect: cardFromEl.getBoundingClientRect(),
        toRect: toEl.getBoundingClientRect(),
      }])
      setTimeout(() => setFlyingCards(fc => fc.filter(f => f.id !== id)), 400)
    }
    setDiscardingId(selected)
    setTimeout(() => {
      const newHand = playerHand.filter(c => c.id !== selected)
      const newDiscard = [...discard, card]
      setDiscardHistory(prev => new Set([...prev, card.id]))
      setDiscardingId(null)
      setSelected(null)
      setDrawnCardId(null)
      setGame(g => ({ ...g, playerHand: newHand, discard: newDiscard }))
      setPhase('computer')
      setMessage('Computer is thinking...')
      setTimeout(() => doComputerTurn(newHand, newDiscard, game.stock), 700)
    }, 200)
  }

  function triggerShowdown() {
    const pDW = bestMelds(game.playerHand).deadwoodValue
    const cDW = bestMelds(game.computerHand).deadwoodValue
    const pHand = [...game.playerHand]
    const cHand = [...game.computerHand]
    let sc = { ...game.scores }
    let msg = ''

    if (pDW === 0 && cDW === 0) {
      msg = 'Showdown — both Gin! No points scored.'
    } else if (pDW === 0) {
      const d = 25 + cDW; sc.player += d
      msg = `Showdown — you have Gin! You score ${d} pts (25 + ${cDW}).`
    } else if (cDW === 0) {
      const d = 25 + pDW; sc.computer += d
      msg = `Showdown — Computer has Gin! Computer scores ${d} pts (25 + ${pDW}).`
    } else if (pDW <= 10 && cDW <= 10) {
      if (pDW > cDW)      { const d = pDW - cDW; sc.player += d;   msg = `Showdown — both knock-ready, higher wins! Your ${pDW} beats ${cDW}. You score ${d} pts.` }
      else if (cDW > pDW) { const d = cDW - pDW; sc.computer += d; msg = `Showdown — both knock-ready, higher wins! Computer's ${cDW} beats ${pDW}. Computer scores ${d} pts.` }
      else                { msg = `Showdown — both knock-ready and tied at ${pDW}! No points.` }
    } else if (pDW <= 10) {
      const d = cDW - pDW; sc.player += d
      msg = `Showdown — you were knock-ready (${pDW} vs ${cDW})! You score ${d} pts.`
    } else if (cDW <= 10) {
      const d = pDW - cDW; sc.computer += d
      msg = `Showdown — Computer was knock-ready (${cDW} vs ${pDW})! Computer scores ${d} pts.`
    } else {
      if (pDW < cDW)      { const d = cDW - pDW; sc.player += d;   msg = `Showdown — lower deadwood wins! Your ${pDW} beats ${cDW}. You score ${d} pts.` }
      else if (cDW < pDW) { const d = pDW - cDW; sc.computer += d; msg = `Showdown — lower deadwood wins! Computer's ${cDW} beats ${pDW}. Computer scores ${d} pts.` }
      else                { msg = `Showdown — tied at ${pDW}! No points.` }
    }

    const playerWonRound = sc.player > game.scores.player
    setStats(prev => {
      const next = { ...prev, roundsWon: prev.roundsWon + (playerWonRound ? 1 : 0), roundsLost: prev.roundsLost + (playerWonRound ? 0 : 1) }
      saveStats(next); return next
    })
    setRoundResult({ msg, playerHand: pHand, computerHand: cHand, pDW, cDW, isShowdown: true })
    setGame(g => ({ ...g, scores: sc, playerHand: pHand, computerHand: cHand }))
    setPhase('result')
    setMessage(msg)
  }

  function doKnock() {
    if (phase !== 'discard') return
    let cardToDiscard
    if (selected) {
      cardToDiscard = playerHand.find(c => c.id === selected)
    } else {
      // Auto-pick optimal discard: card whose removal gives lowest deadwood
      let bestDW = Infinity
      for (const card of playerHand) {
        const { deadwoodValue: dw } = bestMelds(playerHand.filter(c => c.id !== card.id))
        if (dw < bestDW) { bestDW = dw; cardToDiscard = card }
      }
    }
    if (!cardToDiscard) return
    // Fly animation from card's position → discard pile
    const cardFromEl = cardEls.current[cardToDiscard.id]
    const toEl = discardPileRef.current
    if (cardFromEl && toEl) {
      const id = Date.now() + Math.random()
      setFlyingCards(fc => [...fc, {
        id, card: cardToDiscard, faceDown: false,
        fromRect: cardFromEl.getBoundingClientRect(),
        toRect: toEl.getBoundingClientRect(),
      }])
      setTimeout(() => setFlyingCards(fc => fc.filter(f => f.id !== id)), 400)
    }
    const finalHand = playerHand.filter(c => c.id !== cardToDiscard.id)
    resolveKnock(finalHand, computerHand, scores, false)
  }

  const doComputerTurn = useCallback((pHand, dPile, sPile) => {
    const discardTop = dPile.at(-1)
    const drawFrom = computerDraw(computerHand, discardTop, difficulty)
    let newStock = [...sPile], newDiscard = [...dPile], newCompHand = [...computerHand]

    if (drawFrom === 'discard') {
      newCompHand.push(newDiscard.pop())
    } else {
      if (!newStock.length) {
        if ((game.reshuffleCount ?? 0) >= 1) { triggerShowdown(); return }
        newStock = shuffle(newDiscard.slice(0, -1)); newDiscard = [newDiscard.at(-1)]
        setGame(g => ({ ...g, reshuffleCount: (g.reshuffleCount ?? 0) + 1 }))
      }
      newCompHand.push(newStock.pop())
    }

    const discarded = computerDiscard(newCompHand, difficulty, newDiscard)
    newCompHand = newCompHand.filter(c => c.id !== discarded.id)
    newDiscard.push(discarded)
    // Card counting: track comp's picks and discards
    if (drawFrom === 'discard') setCompPickedIds(prev => new Set([...prev, discardTop.id]))
    setDiscardHistory(prev => new Set([...prev, discarded.id]))
    setCompPickedIds(prev => { const n = new Set(prev); n.delete(discarded.id); return n })

    // Fly: draw pile → computer hand
    triggerFly(
      drawFrom === 'discard' ? discardTop : discarded, // face-down for stock
      drawFrom === 'discard' ? discardPileRef : stockRef,
      compHandRef,
      drawFrom === 'stock'
    )
    // Fly: computer hand → discard pile (delayed so it follows the draw animation)
    triggerFly(discarded, compHandRef, discardPileRef, false, 220)

    const { deadwoodValue: compDW } = bestMelds(newCompHand)

    setGame(g => ({ ...g, computerHand: newCompHand, stock: newStock, discard: newDiscard }))

    const fromStr = drawFrom === 'discard'
      ? `discard (${discardTop.rank}${discardTop.suit})`
      : 'stock'
    const compMsg = `Computer drew from ${fromStr}, discarded ${discarded.rank}${discarded.suit}.`

    const knockThreshold = difficulty === "easy" ? 10 : difficulty === "medium" ? 7 : 4
    if (compDW <= knockThreshold) {
      setTimeout(() => resolveKnock(pHand, newCompHand, scores, false, true), 400)
    } else {
      setPhase('draw')
      setMessage(compMsg + ' Your turn!')
    }
  }, [computerHand, scores, difficulty, triggerFly])

  // Super gin: 0 deadwood + at least one run of ≥5 cards in the same suit
  function checkSuperGin(melds, dw) {
    if (dw !== 0) return false
    return melds.some(meld =>
      meld.length >= 5 &&
      new Set(meld.map(c => c.suit)).size === 1
    )
  }

  function resolveKnock(pHand, cHand, sc, _isGin, compKnocked = false) {
    const { melds: pMelds, deadwoodValue: pDW } = bestMelds(pHand)
    const { melds: cMelds, deadwoodValue: cDW } = bestMelds(cHand)

    const pSuperGin = checkSuperGin(pMelds, pDW)
    const cSuperGin = checkSuperGin(cMelds, cDW)

    // Scoring rules:
    //   Super Gin  → 50 bonus + opponent DW
    //   Gin (DW=0) → 25 bonus + opponent DW
    //   Knock      → 25 bonus + (opponent DW − knocker DW)
    //   Undercut   → 25 bonus + (knocker DW − opponent DW) for the other side
    let delta = 0, msg = ''

    // 25-pt bonus only for gin (DW=0); regular knock = difference only
    if (compKnocked) {
      if (cSuperGin) {
        delta = 50 + pDW
        msg = `Computer Super Gin! 🌟 Computer scores ${delta} pts (50 + ${pDW}).`
        sc = { ...sc, computer: sc.computer + delta }
      } else if (cDW === 0) {
        delta = 25 + pDW
        msg = `Computer Gin! Computer scores ${delta} pts (25 + ${pDW}).`
        sc = { ...sc, computer: sc.computer + delta }
      } else if (pDW <= cDW) {
        delta = 25 + (cDW - pDW)
        msg = `Undercut! You score ${delta} pts (25 + ${cDW} − ${pDW}).`
        sc = { ...sc, player: sc.player + delta }
      } else {
        delta = pDW - cDW
        msg = `Computer knocked. Computer scores ${delta} pts (${pDW} − ${cDW}).`
        sc = { ...sc, computer: sc.computer + delta }
      }
    } else if (pSuperGin) {
      delta = 50 + cDW
      msg = `Super Gin! 🌟 You score ${delta} pts (50 + ${cDW}).`
      sc = { ...sc, player: sc.player + delta }
    } else if (pDW === 0) {
      delta = 25 + cDW
      msg = `Gin! You score ${delta} pts (25 + ${cDW}).`
      sc = { ...sc, player: sc.player + delta }
    } else if (cDW <= pDW) {
      delta = 25 + (pDW - cDW)
      msg = `Undercut! Computer scores ${delta} pts (25 + ${pDW} − ${cDW}).`
      sc = { ...sc, computer: sc.computer + delta }
    } else {
      delta = cDW - pDW
      msg = `You knocked! You score ${delta} pts (${cDW} − ${pDW}).`
      sc = { ...sc, player: sc.player + delta }
    }

    // Track round stats
    const playerWonRound = sc.player > scores.player
    setStats(prev => {
      const next = {
        ...prev,
        roundsWon:  prev.roundsWon  + (playerWonRound ? 1 : 0),
        roundsLost: prev.roundsLost + (playerWonRound ? 0 : 1),
      }
      saveStats(next)
      return next
    })

    setRoundResult({ msg, playerHand: pHand, computerHand: cHand, pDW, cDW })
    setGame(g => ({ ...g, scores: sc, playerHand: pHand, computerHand: cHand }))
    setPhase('result')
    setMessage(msg)
  }

  function nextRound() {
    if (game.scores.player >= targetScore || game.scores.computer >= targetScore) {
      const playerWonGame = game.scores.player >= targetScore
      setStats(prev => {
        const next = {
          ...prev,
          gamesWon:  prev.gamesWon  + (playerWonGame ? 1 : 0),
          gamesLost: prev.gamesLost + (playerWonGame ? 0 : 1),
        }
        saveStats(next)
        return next
      })
      const newGame = dealGame()
      setGame(() => ({ ...newGame, scores: { player: 0, computer: 0 } }))
      clearSave()
      setScreen('home')
    } else {
      const newGame = dealGame()
      setGame(() => ({ ...newGame, scores: game.scores }))
      setPhase('draw')
      setMessage('New round! Draw a card.')
    }
    setRoundResult(null)
    setSelected(null)
    setDrawnCardId(null)
    setDiscardHistory(new Set())
    setCompPickedIds(new Set())
  }

  // Build a suit→rank→card lookup for the table layout
  function buildHandTable(hand) {
    const table = {}
    for (const suit of SUITS) table[suit] = {}
    for (const card of hand) table[card.suit][card.rank] = card
    return table
  }

  // Evaluate knock/gin eligibility based on the POST-discard 10-card hand
  const _postDiscard = (phase === 'discard' && selected)
    ? bestMelds(playerHand.filter(c => c.id !== selected))
    : null
  // Best possible result across ALL cards (for pre-selection hint)
  const _bestPostDiscard = phase === 'discard' ? (() => {
    let best = { card: null, deadwoodValue: Infinity, melds: [] }
    for (const card of playerHand) {
      const r = bestMelds(playerHand.filter(c => c.id !== card.id))
      if (r.deadwoodValue < best.deadwoodValue) best = { ...r, card }
    }
    return best
  })() : null
  // Use selected card's result when available, else best-possible
  const _eff = _postDiscard ?? _bestPostDiscard
  const canKnock    = !!_eff && _eff.deadwoodValue <= 10 && _eff.deadwoodValue > 0
  const canGin      = !!_eff && _eff.deadwoodValue === 0
  const canSuperGin = canGin && checkSuperGin(_eff.melds, 0)

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      {/* Header */}
      <header className="border-b border-ink/10 bg-canvas px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <a href="#/" className="text-ink/50 hover:text-accent text-sm font-medium shrink-0">← Gallery</a>
          <h1 className="font-display text-base font-bold text-ink flex-1 text-center">
            🃏 Gin Rummy{screen === 'playing' && <span className="text-ink/40 font-normal text-sm"> · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>}
          </h1>
          <button onClick={() => { clearSave(); setScreen('home') }} className="text-ink/40 hover:text-accent text-sm shrink-0" title="Menu">≡ Menu</button>
          <div className="text-sm font-medium text-ink/70 shrink-0">
            <span className="text-accent font-bold">{scores.player}</span>
            {' · '}
            <span className="font-bold">{scores.computer}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">
        {/* Computer hand */}
        <div ref={compHandRef}>
          <div className="text-xs text-ink/40 uppercase tracking-wider mb-2">Computer — {computerHand.length} cards</div>
          {roundResult
            ? <><HandSummary hand={roundResult.computerHand} /><div className="text-xs text-ink/50 mt-1">Deadwood: {roundResult.cDW}</div></>
            : <div style={{ position: 'relative', height: 62, width: computerHand.length * 18 + 26 }}>
                {computerHand.map((c, i) => (
                  <div key={c.id} style={{ position: 'absolute', left: i * 18, zIndex: i }}>
                    <Card card={c} faceDown small />
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Stock + Discard */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-ink/40 uppercase tracking-wider">Stock ({stock.length})</div>
            {stock.length > 0
              ? <div ref={stockRef} className="inline-block"><Card faceDown onClick={() => drawCard('stock')} /></div>
              : <div className="w-14 h-20 rounded-lg border-2 border-dashed border-ink/20 flex items-center justify-center text-ink/20 text-xs">Empty</div>
            }
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-ink/40 uppercase tracking-wider">Discard</div>
            {discard.length > 0
              ? <div ref={discardPileRef} className="inline-block"><Card key={discard.at(-1).id} card={discard.at(-1)} onClick={phase === 'draw' ? () => drawCard('discard') : undefined} newCard={true} /></div>
              : <div className="w-14 h-20 rounded-lg border-2 border-dashed border-ink/20" />
            }
          </div>
          <div className="flex-1 bg-canvas rounded-xl p-3 text-sm text-ink/70">
            {message}
          </div>
        </div>

        {/* Player hand */}
        <div ref={playerHandRef}>
          <div className="text-xs text-ink/40 uppercase tracking-wider mb-2">
            Your hand — Deadwood: <span className="text-ink font-bold">{playerDW}</span>
            {playerHand.length === 11 && phase !== 'result' && <span className="text-accent ml-2">← tap a card to discard</span>}
          </div>
          {phase === 'result' ? <HandSummary hand={playerHand} /> : (() => {
            const tbl = buildHandTable(playerHand)

            const STEP = 23          // px per rank slot
            const ROW_W = STEP * 12 + 44  // 320px — fits any phone
            return (
              <div className="flex flex-col gap-2">
                {SUITS.map(suit => {
                  const suitCards = tbl[suit]
                  if (Object.keys(suitCards).length === 0) return null
                  return (
                    <div key={suit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 16, flexShrink: 0 }}
                        className={`text-xs font-bold ${isRed(suit) ? 'text-red-500' : 'text-ink/50'}`}>
                        {suit}
                      </span>
                      <div style={{ position: 'relative', width: ROW_W, height: 62 }}>
                        {RANKS.map((rank, ri) => {
                          const card = suitCards[rank]
                          if (!card) return null
                          return (
                            <div key={rank} ref={el => { if (el) cardEls.current[card.id] = el; else delete cardEls.current[card.id] }} style={{ position: 'absolute', left: ri * STEP, zIndex: ri + 1 }}>
                              <Card
                                card={card}
                                selected={selected === card.id}
                                meldColor={selected === card.id ? null : (cardMeldColor[card.id] || null)}
                                newCard={drawnCardId === card.id}
                                discarding={discardingId === card.id}
                                onClick={() => selectCard(card.id)}
                                small
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
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
                onClick={doKnock}
                className="px-6 py-2 bg-accent text-paper font-medium rounded-lg hover:bg-accent/80 transition-colors"
              >
                Knock ({_eff.deadwoodValue} DW)
              </button>
            )}
            {canSuperGin && (
              <button
                onClick={doKnock}
                className="px-6 py-2 bg-purple-600 text-paper font-medium rounded-lg hover:bg-purple-500 transition-colors"
              >
                Super Gin! 🌟
              </button>
            )}
            {canGin && !canSuperGin && (
              <button
                onClick={doKnock}
                className="px-6 py-2 bg-green-600 text-paper font-medium rounded-lg hover:bg-green-500 transition-colors"
              >
                Gin! 🎉
              </button>
            )}
          </div>
        )}

        {/* Round result */}
        {phase === 'result' && roundResult && (
          <div className="bg-canvas rounded-xl p-4 border border-ink/10 animate-slide-up">
            <p className="font-medium text-ink mb-3">{roundResult.msg}</p>
            <p className="text-sm text-ink/60 mb-2">
              Score: You {scores.player} · Computer {scores.computer}
              {(scores.player >= targetScore || scores.computer >= targetScore) && (
                <span className="ml-2 font-bold text-accent">
                  {scores.player >= targetScore ? '🎉 You win the game!' : '😔 Computer wins the game!'}
                </span>
              )}
            </p>
            {/* Overall stats shown when game ends */}
            {(scores.player >= targetScore || scores.computer >= targetScore) && (
              <div className="bg-paper rounded-lg p-3 mb-3 text-xs text-ink/70 flex gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-ink">{stats.gamesWon}<span className="text-ink/30">/{stats.gamesWon + stats.gamesLost}</span></div>
                  <div>Games won</div>
                </div>
                <div className="w-px bg-ink/10" />
                <div className="text-center">
                  <div className="text-lg font-bold text-ink">{stats.roundsWon}<span className="text-ink/30">/{stats.roundsWon + stats.roundsLost}</span></div>
                  <div>Rounds won</div>
                </div>
                <div className="w-px bg-ink/10" />
                <div className="text-center">
                  <div className="text-lg font-bold text-ink">
                    {stats.gamesWon + stats.gamesLost === 0 ? '—' : Math.round(100 * stats.gamesWon / (stats.gamesWon + stats.gamesLost)) + '%'}
                  </div>
                  <div>Win rate</div>
                </div>
              </div>
            )}
            <button
              onClick={nextRound}
              className="px-6 py-2 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors"
            >
              {scores.player >= targetScore || scores.computer >= targetScore ? 'New Game' : 'Next Round'}
            </button>
          </div>
        )}

        {/* Meld legend */}
        <div className="text-xs text-ink/40 flex gap-4 flex-wrap">
          <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: MELD_COLORS[0].bg, border: `1px solid ${MELD_COLORS[0].border}` }} />Meld 1</span>
          <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: MELD_COLORS[1].bg, border: `1px solid ${MELD_COLORS[1].border}` }} />Meld 2</span>
          <span><span className="inline-block w-3 h-3 rounded mr-1" style={{ background: MELD_COLORS[2].bg, border: `1px solid ${MELD_COLORS[2].border}` }} />Meld 3</span>
          <span><span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-400 mr-1" />Selected</span>
          <span><span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-400 mr-1" />Just drawn</span>
        </div>
      </main>

      {/* Fixed bottom-right buttons — only during gameplay */}
      <div className={`fixed bottom-5 right-5 flex flex-col gap-2 z-50 ${screen !== 'playing' ? 'hidden' : ''}`}>
        {cardCounting && (
          <button
            onClick={() => setShowCounting(v => !v)}
            className={`w-9 h-9 rounded-full text-sm shadow-lg transition-colors ${showCounting ? 'bg-blue-500 text-white' : 'bg-ink text-paper hover:bg-ink/80'}`}
            title="Card counting"
          >👁</button>
        )}
        <button
          onClick={() => setShowStats(true)}
          className="w-9 h-9 rounded-full bg-ink text-paper text-sm font-bold shadow-lg hover:bg-ink/80 transition-colors"
          title="Stats"
        >📊</button>
        <button
          onClick={() => setShowHelp(true)}
          className="w-9 h-9 rounded-full bg-ink text-paper text-sm font-bold shadow-lg hover:bg-ink/80 transition-colors"
          aria-label="Help"
        >?</button>
      </div>

      {/* Card counting panel */}
      {cardCounting && showCounting && screen === 'playing' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
          <div className="bg-paper border-t border-ink/10 shadow-xl max-w-2xl mx-auto p-4 pb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-ink">Card Counting</h3>
              <div className="flex gap-3 text-xs text-ink/50">
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-500 mr-1" />Your hand</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-400 mr-1" />Comp has</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-ink/10 border border-ink/20 mr-1" />Discarded</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-white border border-ink/30 mr-1" />Unknown</span>
              </div>
            </div>
            {SUITS.map(suit => {
              const red = isRed(suit)
              return (
                <div key={suit} className="flex items-center gap-1 mb-1">
                  <span className={`text-xs font-bold w-4 flex-shrink-0 ${red ? 'text-red-500' : 'text-ink/60'}`}>{suit}</span>
                  <div className="flex gap-0.5 flex-wrap">
                    {RANKS.map(rank => {
                      const cardId = `${rank}${suit}`
                      const inHand    = playerHand.some(c => c.id === cardId)
                      const compHas   = compPickedIds.has(cardId)
                      const discarded = discardHistory.has(cardId) || discard.some((c, i) => c.id === cardId && i < discard.length - 1)
                      const inDiscard = discard.at(-1)?.id === cardId
                      let bg = 'bg-white border-ink/25'
                      let textColor = 'text-ink/70'
                      let extra = ''
                      if (inHand)         { bg = 'bg-green-100 border-green-500'; textColor = 'text-green-800' }
                      else if (compHas)   { bg = 'bg-orange-100 border-orange-400'; textColor = 'text-orange-700' }
                      else if (inDiscard) { bg = 'bg-blue-50 border-blue-400'; textColor = 'text-blue-700' }
                      else if (discarded) { bg = 'bg-ink/8 border-ink/15'; textColor = 'text-ink/30'; extra = 'line-through' }
                      return (
                        <span key={rank} className={`inline-flex items-center justify-center text-[10px] font-bold rounded border px-1 py-0.5 min-w-[20px] ${bg} ${textColor}`}>
                          <span className={extra}>{rank}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowStats(false)}>
          <div className="bg-paper rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-ink">Your Stats</h2>
              <button onClick={() => setShowStats(false)} className="text-ink/40 hover:text-ink text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Games Won',  value: stats.gamesWon,   color: 'text-green-600' },
                { label: 'Games Lost', value: stats.gamesLost,  color: 'text-red-500'   },
                { label: 'Rounds Won',  value: stats.roundsWon,  color: 'text-green-600' },
                { label: 'Rounds Lost', value: stats.roundsLost, color: 'text-red-500'   },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-canvas rounded-xl p-3 text-center">
                  <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-ink/50 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-canvas rounded-xl p-3 text-center mb-5">
              <div className="text-3xl font-bold text-ink">
                {stats.gamesWon + stats.gamesLost === 0
                  ? '—'
                  : Math.round(100 * stats.gamesWon / (stats.gamesWon + stats.gamesLost)) + '%'}
              </div>
              <div className="text-xs text-ink/50 mt-0.5">Game Win Rate</div>
            </div>

            <button
              onClick={() => {
                const reset = { gamesWon:0, gamesLost:0, roundsWon:0, roundsLost:0 }
                saveStats(reset)
                setStats(reset)
              }}
              className="w-full py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              Reset Stats
            </button>
          </div>
        </div>
      )}

      {/* Home screen */}
      {screen === 'home' && (
        <div className="fixed inset-0 bg-canvas z-40 flex flex-col">
          <header className="border-b border-ink/10 px-4 py-3 flex items-center">
            <a href="#/" className="text-ink/50 hover:text-accent text-sm font-medium">← Gallery</a>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-5xl mb-4">🃏</div>
          <h2 className="text-3xl font-bold text-ink mb-1">Gin Rummy</h2>
          <p className="text-ink/40 text-sm mb-8">Classic card game vs computer</p>

          {/* Quick stats if any games played */}
          {(stats.gamesWon + stats.gamesLost) > 0 && (
            <div className="flex gap-6 mb-8 text-center">
              <div>
                <div className="text-xl font-bold text-green-600">{stats.gamesWon}</div>
                <div className="text-xs text-ink/40">Won</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-500">{stats.gamesLost}</div>
                <div className="text-xs text-ink/40">Lost</div>
              </div>
              <div>
                <div className="text-xl font-bold text-ink">
                  {Math.round(100 * stats.gamesWon / (stats.gamesWon + stats.gamesLost))}%
                </div>
                <div className="text-xs text-ink/40">Win rate</div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowConfig(true)}
            className="w-full max-w-xs py-4 bg-ink text-paper text-lg font-semibold rounded-2xl hover:bg-ink/80 transition-colors shadow-lg mb-4"
          >
            Play →
          </button>

          {/* Resume button if save exists */}
          {_save && (
            <button
              onClick={() => setScreen('playing')}
              className="w-full max-w-xs py-3 bg-ink/10 text-ink text-sm font-medium rounded-xl hover:bg-ink/20 transition-colors mb-4"
            >
              ↩ Resume saved game
            </button>
          )}

          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowStats(true)}
              className="w-10 h-10 rounded-full bg-ink/10 text-lg hover:bg-ink/20 transition-colors"
              title="Stats">📊</button>
            <button onClick={() => setShowHelp(true)}
              className="w-10 h-10 rounded-full bg-ink/10 text-ink font-bold hover:bg-ink/20 transition-colors"
              title="How to play">?</button>
          </div>
          </div>
        </div>
      )}

      {/* Config modal — shown after Play is tapped on home screen */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowConfig(false)}>
          <div className="bg-paper rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-ink mb-1">New Game</h2>
            <p className="text-sm text-ink/50 mb-5">Set up your game</p>

            <div className="mb-5">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2">Difficulty</p>
              <div className="flex gap-2">
                {[["easy","Easy","bg-green-500"],["medium","Medium","bg-yellow-500"],["hard","Hard","bg-red-500"]].map(([val,label,color]) => (
                  <button key={val} onClick={() => setDifficulty(val)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${difficulty === val ? color + " text-white" : "bg-ink/10 text-ink/60 hover:bg-ink/20"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2">Target Score</p>
              <div className="flex gap-2">
                {[50, 100, 200].map(pts => (
                  <button key={pts} onClick={() => setTargetScore(pts)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${targetScore === pts ? "bg-accent text-white" : "bg-ink/10 text-ink/60 hover:bg-ink/20"}`}>
                    {pts} pts
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2">Card Counting</p>
              <button onClick={() => setCardCounting(v => !v)}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${cardCounting ? 'bg-blue-500 text-white' : 'bg-ink/10 text-ink/60 hover:bg-ink/20'}`}>
                {cardCounting ? '👁 Enabled — Strong Memory' : '👁 Disabled'}
              </button>
              <p className="text-xs text-ink/40 mt-1">Shows which cards were discarded and what the computer likely holds</p>
            </div>

            <button onClick={() => {
              clearSave()
              setShowConfig(false)
              setScreen('playing')
              setGame(dealGame())
              setPhase('draw')
              setSelected(null)
              setRoundResult(null)
              setMessage('Draw a card to start!')
              setDiscardHistory(new Set())
              setCompPickedIds(new Set())
            }}
              className="w-full py-3 bg-ink text-paper font-semibold rounded-xl hover:bg-ink/80 transition-colors">
              Play →
            </button>
          </div>
        </div>
      )}

      {/* Help modal */}
      {/* Flying card overlays */}
      {flyingCards.map(f => (
        <FlyingCard key={f.id} card={f.card} fromRect={f.fromRect} toRect={f.toRect} faceDown={f.faceDown} />
      ))}

      {showHelp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-paper rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-ink">How to Play — Gin Rummy</h2>
              <button onClick={() => setShowHelp(false)} className="text-ink/40 hover:text-ink text-xl leading-none">✕</button>
            </div>

            <div className="space-y-4 text-sm text-ink/80">
              <section>
                <h3 className="font-semibold text-ink mb-1">🎯 Goal</h3>
                <p>Form your 10 cards into <strong>melds</strong> and reduce your <strong>deadwood</strong> (unmelded cards) to 10 or less to Knock, or 0 to Gin.</p>
              </section>

              <section>
                <h3 className="font-semibold text-ink mb-1">🃏 Melds</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Set</strong> — 3 or 4 cards of the same rank (e.g. 7♠ 7♥ 7♦)</li>
                  <li><strong>Run</strong> — 3+ consecutive cards of the same suit (e.g. 5♣ 6♣ 7♣)</li>
                </ul>
                <p className="mt-1">Meld groups are highlighted in color automatically.</p>
              </section>

              <section>
                <h3 className="font-semibold text-ink mb-1">🔄 Each Turn</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Draw from the <strong>Stock</strong> (face-down) or <strong>Discard</strong> pile</li>
                  <li>Tap a card to select it, tap again to discard it — or use the Discard button</li>
                </ol>
              </section>

              <section>
                <h3 className="font-semibold text-ink mb-1">🏁 Ending a Round</h3>
                <p>After drawing, select the card you want to discard. If the remaining 10 cards qualify:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li><strong>Knock</strong> — deadwood ≤ 10. Score = your opponent's DW − yours</li>
                  <li><strong>Gin</strong> 🎉 — deadwood = 0. Score = 25 + opponent's DW</li>
                  <li><strong>Super Gin</strong> 🌟 — Gin with a 5-card same-suit run. Score = 50 + opponent's DW</li>
                  <li><strong>Undercut</strong> — if you knock but your opponent's DW ≤ yours, opponent scores 25 + difference</li>
                  <li><strong>Showdown</strong> — if the stock runs out twice, both hands are revealed. Gin (0) always wins. Both ≤ 10: higher deadwood wins. Both &gt; 10: lower wins. Only one ≤ 10: that player wins.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-ink mb-1">🏆 Winning</h3>
                <p>First player to reach <strong>{targetScore} points</strong> wins the game.</p>
              </section>

              <section>
                <h3 className="font-semibold text-ink mb-1">🎨 Card Colors</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {MELD_COLORS.map((c, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded" style={{ background: c.bg, border: `1px solid ${c.border}` }} />
                      <span>Meld {i + 1}</span>
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-400" />
                    <span>Selected</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-400" />
                    <span>Just drawn</span>
                  </span>
                </div>
              </section>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full py-2 bg-ink text-paper rounded-lg font-medium hover:bg-ink/80 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
