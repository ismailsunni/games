import { useState, useEffect, useRef } from 'react'

function idx(l, r, c) { return l * 9 + r * 3 + c }

function generateWinLines() {
  const lines = []
  for (let l = 0; l < 3; l++) {
    for (let i = 0; i < 3; i++) {
      lines.push([idx(l,i,0), idx(l,i,1), idx(l,i,2)])
      lines.push([idx(l,0,i), idx(l,1,i), idx(l,2,i)])
    }
    lines.push([idx(l,0,0), idx(l,1,1), idx(l,2,2)])
    lines.push([idx(l,0,2), idx(l,1,1), idx(l,2,0)])
  }
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      lines.push([idx(0,r,c), idx(1,r,c), idx(2,r,c)])
  for (let c = 0; c < 3; c++) {
    lines.push([idx(0,0,c), idx(1,1,c), idx(2,2,c)])
    lines.push([idx(0,2,c), idx(1,1,c), idx(2,0,c)])
  }
  for (let r = 0; r < 3; r++) {
    lines.push([idx(0,r,0), idx(1,r,1), idx(2,r,2)])
    lines.push([idx(0,r,2), idx(1,r,1), idx(2,r,0)])
  }
  lines.push([idx(0,0,0), idx(1,1,1), idx(2,2,2)])
  lines.push([idx(0,0,2), idx(1,1,1), idx(2,2,0)])
  lines.push([idx(0,2,0), idx(1,1,1), idx(2,0,2)])
  lines.push([idx(0,2,2), idx(1,1,1), idx(2,0,0)])
  return lines
}

const WIN_LINES = generateWinLines()

function checkWinner(squares, linesToWin) {
  const xLines = [], oLines = []
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      if (squares[a] === 'X') xLines.push(line)
      else oLines.push(line)
    }
  }
  if (xLines.length >= linesToWin) return { winner: 'X', lines: xLines }
  if (oLines.length >= linesToWin) return { winner: 'O', lines: oLines }
  return null
}

function getCompletedLineCells(squares) {
  const xCells = new Set(), oCells = new Set()
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      const target = squares[a] === 'X' ? xCells : oCells
      line.forEach(i => target.add(i))
    }
  }
  return { xCells, oCells }
}

// ── AI ───────────────────────────────────────────────────────
function easyMove(squares) {
  const empty = squares.map((v, i) => v ? null : i).filter(i => i !== null)
  return empty[Math.floor(Math.random() * empty.length)] ?? -1
}

function mediumMove(squares, linesToWin, cpuMark, playerMark) {
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    const t = [...squares]; t[i] = cpuMark
    if (checkWinner(t, linesToWin)?.winner === cpuMark) return i
  }
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    const t = [...squares]; t[i] = playerMark
    if (checkWinner(t, linesToWin)?.winner === playerMark) return i
  }
  let best = -Infinity, move = -1
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    let s = 0
    const t = [...squares]; t[i] = cpuMark
    for (const line of WIN_LINES) {
      const vals = line.map(j => t[j])
      if (!vals.includes(playerMark)) s += vals.filter(v => v === cpuMark).length * 2
      if (!vals.includes(cpuMark))    s -= vals.filter(v => v === playerMark).length
    }
    if (s > best) { best = s; move = i }
  }
  return move === -1 ? easyMove(squares) : move
}

function minimaxAB(squares, isMax, alpha, beta, depth, linesToWin, cpuMark, playerMark) {
  const result = checkWinner(squares, linesToWin)
  if (result?.winner === cpuMark)    return 10 + depth
  if (result?.winner === playerMark) return -10 - depth
  if (squares.every(Boolean)) return 0
  if (depth <= 0) {
    let s = 0
    for (const line of WIN_LINES) {
      const vals = line.map(i => squares[i])
      if (!vals.includes(playerMark) && vals.includes(cpuMark))    s += vals.filter(v => v === cpuMark).length
      if (!vals.includes(cpuMark)    && vals.includes(playerMark)) s -= vals.filter(v => v === playerMark).length
    }
    return s
  }
  if (isMax) {
    let best = -Infinity
    for (let i = 0; i < 27; i++) {
      if (!squares[i]) {
        squares[i] = cpuMark
        best = Math.max(best, minimaxAB(squares, false, alpha, beta, depth - 1, linesToWin, cpuMark, playerMark))
        squares[i] = null
        alpha = Math.max(alpha, best)
        if (beta <= alpha) break
      }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < 27; i++) {
      if (!squares[i]) {
        squares[i] = playerMark
        best = Math.min(best, minimaxAB(squares, true, alpha, beta, depth - 1, linesToWin, cpuMark, playerMark))
        squares[i] = null
        beta = Math.min(beta, best)
        if (beta <= alpha) break
      }
    }
    return best
  }
}

function hardMove(squares, linesToWin, cpuMark, playerMark) {
  let best = -Infinity, move = -1
  for (let i = 0; i < 27; i++) {
    if (!squares[i]) {
      squares[i] = cpuMark
      const s = minimaxAB(squares, false, -Infinity, Infinity, 5, linesToWin, cpuMark, playerMark)
      squares[i] = null
      if (s > best) { best = s; move = i }
    }
  }
  return move
}

// ── Storage ──────────────────────────────────────────────────
const STORAGE_STATE = 'ttt3d_state'
const STORAGE_STATS = 'ttt3d_stats'

function loadStats() {
  try {
    const s = localStorage.getItem(STORAGE_STATS)
    return s ? JSON.parse(s) : { wins: 0, losses: 0, draws: 0 }
  } catch { return { wins: 0, losses: 0, draws: 0 } }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_STATS, JSON.stringify(stats))
}

function loadGameState() {
  try {
    const s = localStorage.getItem(STORAGE_STATE)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function saveGameState(state) {
  localStorage.setItem(STORAGE_STATE, JSON.stringify(state))
}

function clearGameState() {
  localStorage.removeItem(STORAGE_STATE)
}

// ── Cube View ────────────────────────────────────────────────
const CELL    = 56
const GAP     = 7
const GRID    = CELL * 3 + GAP * 2
const LAYER_Z = 84

const LAYER_TINT = [
  'rgba(230,57,70,0.07)',
  'rgba(26,26,46,0.04)',
  'rgba(59,130,246,0.07)',
]

function cubeStyle(sq, xCells, oCells, sqIdx) {
  if (xCells.has(sqIdx)) return { border: '2px solid #22c55e', background: 'rgba(187,247,208,0.92)', color: '#15803d' }
  if (oCells.has(sqIdx)) return { border: '2px solid #3b82f6', background: 'rgba(219,234,254,0.92)', color: '#1d4ed8' }
  if (sq === 'X') return { border: '2px solid rgba(230,57,70,0.45)', background: 'rgba(254,226,226,0.88)', color: '#e63946' }
  if (sq === 'O') return { border: '2px solid rgba(26,26,46,0.2)',   background: 'rgba(226,232,240,0.88)', color: '#1a1a2e' }
  return { border: '2px solid rgba(26,26,46,0.1)', background: 'rgba(255,255,255,0.78)', color: '#1a1a2e' }
}

function CubeBoard({ squares, xCells, oCells, playerTurn, onCellClick }) {
  const rotRef  = useRef({ x: -22, y: 28 })
  const velRef  = useRef({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const rafRef  = useRef(null)
  const [rot, setRot] = useState({ x: -22, y: 28 })

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    cancelAnimationFrame(rafRef.current)
    velRef.current = { x: 0, y: 0 }
    dragRef.current = { px: e.clientX, py: e.clientY }
  }
  function onPointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.px
    const dy = e.clientY - dragRef.current.py
    velRef.current = { x: dx * 0.5, y: dy * 0.4 }
    rotRef.current = {
      x: Math.max(-70, Math.min(60, rotRef.current.x - dy * 0.4)),
      y: rotRef.current.y + dx * 0.5,
    }
    dragRef.current = { px: e.clientX, py: e.clientY }
    setRot({ ...rotRef.current })
  }
  function onPointerUp() {
    dragRef.current = null
    let { x: vx, y: vy } = velRef.current
    function coast() {
      if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return
      rotRef.current = {
        x: Math.max(-70, Math.min(60, rotRef.current.x - vy)),
        y: rotRef.current.y + vx,
      }
      vx *= 0.90; vy *= 0.90
      setRot({ ...rotRef.current })
      rafRef.current = requestAnimationFrame(coast)
    }
    rafRef.current = requestAnimationFrame(coast)
  }

  return (
    <div
      style={{ perspective: '1000px', width: GRID + 140, height: GRID + 140, margin: 'auto', userSelect: 'none' }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
    >
      <div style={{
        width: GRID, height: GRID, margin: 70, position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
      }}>
        {[0, 1, 2].map(layer => (
          <div key={layer} style={{
            position: 'absolute', top: 0, left: 0, width: GRID, height: GRID,
            transform: `translateZ(${(layer - 1) * LAYER_Z}px)`,
          }}>
            <div style={{
              position: 'absolute', inset: -6, background: LAYER_TINT[layer],
              border: '1px solid rgba(26,26,46,0.08)', borderRadius: 12, pointerEvents: 'none',
            }} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${CELL}px)`,
              gridTemplateRows: `repeat(3, ${CELL}px)`,
              gap: GAP, position: 'relative',
            }}>
              {Array.from({ length: 9 }, (_, i) => {
                const sqIdx = layer * 9 + i
                const sq = squares[sqIdx]
                const s = cubeStyle(sq, xCells, oCells, sqIdx)
                return (
                  <button key={i} onClick={() => onCellClick(sqIdx)} style={{
                    width: CELL, height: CELL, fontSize: 20, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, border: s.border, background: s.background, color: s.color,
                    cursor: !sq && playerTurn ? 'pointer' : 'default',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)', transition: 'background 0.12s',
                  }}>
                    {sq}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Layer View ───────────────────────────────────────────────
function layerClass(sq, xCells, oCells, sqIdx, playerTurn) {
  if (xCells.has(sqIdx)) return 'border-green-500 bg-green-50 text-green-700'
  if (oCells.has(sqIdx)) return 'border-blue-500 bg-blue-50 text-blue-700'
  if (sq === 'X') return 'text-accent border-accent/40 bg-accent/5'
  if (sq === 'O') return 'text-ink border-ink/30 bg-canvas'
  if (playerTurn) return 'border-ink/20 bg-white hover:bg-canvas hover:border-ink/40 cursor-pointer'
  return 'border-ink/10 bg-white cursor-default'
}

function LayerBoard({ squares, xCells, oCells, playerTurn, onCellClick }) {
  return (
    <div className="flex flex-wrap justify-center gap-8">
      {[0, 1, 2].map(layer => (
        <div key={layer} className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Layer {layer + 1}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }, (_, i) => {
              const sqIdx = layer * 9 + i
              const sq = squares[sqIdx]
              return (
                <button key={i} onClick={() => onCellClick(sqIdx)}
                  className={['w-16 h-16 text-2xl font-bold rounded-lg border-2 transition-all duration-150 flex items-center justify-center',
                    layerClass(sq, xCells, oCells, sqIdx, playerTurn)].join(' ')}>
                  {sq}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Line progress ────────────────────────────────────────────
function LineProgress({ squares, linesToWin, playerMark, cpuMark }) {
  const count = (mark) => WIN_LINES.filter(([a, b, c]) =>
    squares[a] === mark && squares[b] === mark && squares[c] === mark
  ).length
  const playerCount = count(playerMark)
  const cpuCount    = count(cpuMark)

  return (
    <div className="flex gap-8 text-sm">
      {[
        { label: `You (${playerMark})`, n: playerCount, color: 'green' },
        { label: `CPU (${cpuMark})`,    n: cpuCount,    color: 'blue'  },
      ].map(({ label, n, color }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <span className={`font-bold text-xs ${color === 'green' ? 'text-green-600' : 'text-blue-600'}`}>{label}</span>
          <div className="flex gap-1">
            {Array.from({ length: linesToWin }, (_, i) => (
              <div key={i} className={[
                'w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold',
                i < n
                  ? color === 'green' ? 'border-green-500 bg-green-50 text-green-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-ink/20 bg-white text-ink/20'
              ].join(' ')}>
                {i < n ? '✓' : '·'}
              </div>
            ))}
          </div>
          <span className="text-ink/40 text-xs">{n}/{linesToWin}</span>
        </div>
      ))}
    </div>
  )
}

// ── Config modal ─────────────────────────────────────────────
function ConfigModal({ config, onChange, onPlay, hasSavedGame, onContinue }) {
  const { difficulty, linesToWin, computerFirst, viewMode } = config

  function opt(label, value, current, key) {
    const active = current === value
    return (
      <button key={String(value)}
        onClick={() => onChange({ ...config, [key]: value })}
        className={['px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
          active ? 'bg-ink text-paper border-ink' : 'bg-white text-ink/60 border-ink/20 hover:border-ink/40'].join(' ')}>
        {label}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <h2 className="font-display text-xl font-bold text-ink text-center">New Game</h2>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">First move</span>
          <div className="flex gap-2">
            {opt('You', false, computerFirst, 'computerFirst')}
            {opt('Computer', true, computerFirst, 'computerFirst')}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Difficulty</span>
          <div className="flex gap-2 flex-wrap">
            {['Easy', 'Medium', 'Hard'].map(d => opt(d, d, difficulty, 'difficulty'))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Lines to win</span>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(n => opt(String(n), n, linesToWin, 'linesToWin'))}
          </div>
          <p className="text-xs text-ink/40 min-h-[1rem]">
            {linesToWin === 1 && 'Classic — first line wins. First player advantage.'}
            {linesToWin === 2 && 'Balanced — need 2 lines. Recommended ✓'}
            {linesToWin === 3 && 'Challenging — games tend to go long.'}
            {linesToWin === 4 && 'Expert — center cell touches 13 lines! 🔥'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Board view</span>
          <div className="flex gap-2">
            {opt('☰ Layers', 'layer', viewMode, 'viewMode')}
            {opt('⬡ Cube',   'cube',  viewMode, 'viewMode')}
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <button onClick={onPlay}
            className="w-full bg-accent text-white font-bold py-3 rounded-xl text-base hover:opacity-90 transition-opacity">
            Play →
          </button>
          {hasSavedGame && (
            <button onClick={onContinue}
              className="w-full border border-ink/20 text-ink font-medium py-2.5 rounded-xl text-sm hover:border-accent hover:text-accent transition-colors">
              Continue saved game
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stats modal ──────────────────────────────────────────────
function StatsModal({ stats, onClose, onReset }) {
  const total = stats.wins + stats.losses + stats.draws
  const winPct = total > 0 ? Math.round((stats.wins / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Stats</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Wins',   value: stats.wins,   color: 'text-green-600' },
            { label: 'Losses', value: stats.losses, color: 'text-red-500'   },
            { label: 'Draws',  value: stats.draws,  color: 'text-ink/60'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-paper rounded-xl p-3 flex flex-col gap-0.5">
              <span className={`text-3xl font-bold ${color}`}>{value}</span>
              <span className="text-xs text-ink/50">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-ink/60">Win rate</span>
            <span className="font-bold text-ink">{winPct}%</span>
          </div>
          <div className="w-full bg-ink/10 rounded-full h-2">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${winPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-ink/40">
            <span>{total} game{total !== 1 ? 's' : ''} played</span>
            <span>{stats.draws} draw{stats.draws !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <button onClick={() => { onReset(); onClose() }}
          className="text-xs text-ink/30 hover:text-red-400 transition-colors text-center">
          Reset stats
        </button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────
const DEFAULT_CONFIG = { difficulty: 'Hard', linesToWin: 2, computerFirst: false, viewMode: 'layer' }

export default function TicTacToe3D() {
  const [phase, setPhase]       = useState('lobby')
  const [config, setConfig]     = useState(DEFAULT_CONFIG)
  const [squares, setSquares]   = useState(Array(27).fill(null))
  const [thinking, setThinking] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats]       = useState(() => loadStats())
  const [savedGame, setSavedGame] = useState(() => loadGameState())
  const pendingRef = useRef(false)

  const { difficulty, linesToWin, computerFirst, viewMode } = config
  const playerMark = computerFirst ? 'O' : 'X'
  const cpuMark    = computerFirst ? 'X' : 'O'

  const result   = checkWinner(squares, linesToWin)
  const winner   = result?.winner
  const draw     = !winner && squares.every(Boolean)
  const gameOver = winner || draw

  const moveCount      = squares.filter(Boolean).length
  const isComputerTurn = !gameOver && !thinking && (moveCount % 2 === (computerFirst ? 0 : 1))
  const playerTurn     = !gameOver && !thinking && !isComputerTurn

  const { xCells, oCells } = getCompletedLineCells(squares)

  // Persist game state whenever board changes mid-game
  useEffect(() => {
    if (phase === 'playing' && !gameOver) {
      const state = { squares, config }
      saveGameState(state)
      setSavedGame(state)
    }
  }, [squares, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear saved game on game over and update stats
  useEffect(() => {
    if (phase === 'playing' && gameOver) {
      clearGameState()
      setSavedGame(null)
      const newStats = loadStats()
      if (winner === playerMark) newStats.wins++
      else if (winner === cpuMark) newStats.losses++
      else newStats.draws++
      saveStats(newStats)
      setStats(newStats)
    }
  }, [gameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI move
  useEffect(() => {
    if (phase !== 'playing') return
    if (isComputerTurn && !pendingRef.current) {
      pendingRef.current = true
      setThinking(true)
      const timer = setTimeout(() => {
        let move = -1
        const copy = [...squares]
        if (difficulty === 'Easy')        move = easyMove(copy)
        else if (difficulty === 'Medium') move = mediumMove(copy, linesToWin, cpuMark, playerMark)
        else                              move = hardMove(copy, linesToWin, cpuMark, playerMark)
        if (move !== -1) {
          const next = [...squares]; next[move] = cpuMark
          setSquares(next)
        }
        pendingRef.current = false
        setThinking(false)
      }, 150)
      return () => { clearTimeout(timer); pendingRef.current = false }
    }
  }, [squares, gameOver, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(i) {
    if (!playerTurn || squares[i]) return
    const next = [...squares]; next[i] = playerMark
    setSquares(next)
  }

  function startFresh() {
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
    setPhase('playing')
  }

  function continueSaved() {
    const s = savedGame
    if (!s) return
    pendingRef.current = false
    setConfig(s.config)
    setSquares(s.squares)
    setThinking(false)
    setPhase('playing')
  }

  function handlePlayAgain() {
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
    setPhase('playing')
  }

  function handleSettings() {
    // Count as a loss only if the player made at least one move
    const playerMoves = squares.filter(v => v === playerMark).length
    if (playerMoves > 0) {
      const newStats = loadStats()
      newStats.losses++
      saveStats(newStats)
      setStats(newStats)
    }
    clearGameState()
    setSavedGame(null)
    pendingRef.current = false
    setThinking(false)
    setPhase('lobby')
  }

  function resetStats() {
    const fresh = { wins: 0, losses: 0, draws: 0 }
    saveStats(fresh)
    setStats(fresh)
  }

  let status
  if (winner === playerMark)   status = 'You win! 🎉'
  else if (winner === cpuMark) status = 'Computer wins 😔'
  else if (draw)               status = 'Draw 🤝'
  else if (thinking)           status = 'Computer thinking...'
  else                         status = 'Your turn'

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <a href="#/" className="text-ink/50 hover:text-accent transition-colors text-sm font-medium shrink-0">← Gallery</a>
          <h1 className="font-display text-lg font-bold text-ink flex-1 truncate">Tic-Tac-3D</h1>
          <button onClick={() => setShowStats(true)}
            className="text-sm text-ink/50 hover:text-accent transition-colors font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-accent shrink-0">
            📊 Stats
          </button>
          {phase === 'playing' && !gameOver && (
            <button onClick={handleSettings}
              className="text-sm text-ink/50 hover:text-red-400 transition-colors font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-red-300 shrink-0">
              {moveCount === 0 ? 'New Game' : 'Give Up'}
            </button>
          )}
        </div>
      </header>

      {/* Modals */}
      {phase === 'lobby' && (
        <ConfigModal
          config={config} onChange={setConfig}
          onPlay={startFresh}
          hasSavedGame={!!savedGame}
          onContinue={continueSaved}
        />
      )}
      {showStats && (
        <StatsModal stats={stats} onClose={() => setShowStats(false)} onReset={resetStats} />
      )}

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center gap-8">
        {/* Status */}
        <p className="text-lg font-medium text-ink/70">{status}</p>

        {/* Line progress */}
        {phase === 'playing' && !gameOver && (
          <LineProgress squares={squares} linesToWin={linesToWin} playerMark={playerMark} cpuMark={cpuMark} />
        )}

        {/* View toggle — available during play */}
        {phase === 'playing' && (
          <div className="flex rounded-lg border border-ink/20 overflow-hidden">
            {[['layer', '☰ Layers'], ['cube', '⬡ Cube']].map(([v, label]) => (
              <button key={v} onClick={() => setConfig(c => ({ ...c, viewMode: v }))}
                className={['px-4 py-1.5 text-sm font-medium transition-colors',
                  viewMode === v ? 'bg-ink text-paper' : 'bg-paper text-ink/60 hover:bg-canvas'].join(' ')}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Board */}
        {viewMode === 'cube' ? (
          <div className="w-full flex flex-col items-center">
            <CubeBoard squares={squares} xCells={xCells} oCells={oCells} playerTurn={playerTurn} onCellClick={handleClick} />
            <p className="mt-4 text-xs text-ink/30">Drag to rotate</p>
          </div>
        ) : (
          <LayerBoard squares={squares} xCells={xCells} oCells={oCells} playerTurn={playerTurn} onCellClick={handleClick} />
        )}

        {/* Game over */}
        {gameOver && (
          <div className="flex flex-col items-center gap-3">
            <button onClick={handlePlayAgain}
              className="px-8 py-3 bg-accent text-paper font-medium rounded-lg hover:opacity-90 transition-opacity">
              Play again
            </button>
            <button onClick={handleSettings}
              className="text-sm text-ink/50 hover:text-accent transition-colors">
              Change settings
            </button>
          </div>
        )}

        {/* Legend */}
        {phase === 'playing' && (
          <div className="flex gap-6 text-sm text-ink/40">
            <span><span className="text-accent font-bold">{playerMark}</span> You</span>
            <span><span className="font-bold text-ink/60">{cpuMark}</span> CPU · {difficulty}</span>
            <span>{linesToWin} line{linesToWin > 1 ? 's' : ''} to win</span>
          </div>
        )}
      </main>
    </div>
  )
}
