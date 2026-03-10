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

function checkWinner(squares) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c])
      return { winner: squares[a], line }
  }
  return null
}

function easyMove(squares) {
  const empty = squares.map((v, i) => v ? null : i).filter(i => i !== null)
  return empty[Math.floor(Math.random() * empty.length)] ?? -1
}

function mediumMove(squares) {
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    const t = [...squares]; t[i] = 'O'
    if (checkWinner(t)?.winner === 'O') return i
  }
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    const t = [...squares]; t[i] = 'X'
    if (checkWinner(t)?.winner === 'X') return i
  }
  let best = -Infinity, move = -1
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    let s = 0
    const t = [...squares]; t[i] = 'O'
    for (const line of WIN_LINES) {
      const vals = line.map(j => t[j])
      if (!vals.includes('X')) s += vals.filter(v => v === 'O').length * 2
      if (!vals.includes('O')) s -= vals.filter(v => v === 'X').length
    }
    if (s > best) { best = s; move = i }
  }
  return move === -1 ? easyMove(squares) : move
}

function minimaxAB(squares, isMax, alpha, beta, depth) {
  const result = checkWinner(squares)
  if (result?.winner === 'O') return 10 + depth
  if (result?.winner === 'X') return -10 - depth
  if (squares.every(Boolean)) return 0
  if (depth <= 0) {
    let s = 0
    for (const line of WIN_LINES) {
      const vals = line.map(i => squares[i])
      if (!vals.includes('X') && vals.includes('O')) s += vals.filter(v => v === 'O').length
      if (!vals.includes('O') && vals.includes('X')) s -= vals.filter(v => v === 'X').length
    }
    return s
  }
  if (isMax) {
    let best = -Infinity
    for (let i = 0; i < 27; i++) {
      if (!squares[i]) {
        squares[i] = 'O'
        best = Math.max(best, minimaxAB(squares, false, alpha, beta, depth - 1))
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
        squares[i] = 'X'
        best = Math.min(best, minimaxAB(squares, true, alpha, beta, depth - 1))
        squares[i] = null
        beta = Math.min(beta, best)
        if (beta <= alpha) break
      }
    }
    return best
  }
}

function hardMove(squares) {
  let best = -Infinity, move = -1
  for (let i = 0; i < 27; i++) {
    if (!squares[i]) {
      squares[i] = 'O'
      const s = minimaxAB(squares, false, -Infinity, Infinity, 5)
      squares[i] = null
      if (s > best) { best = s; move = i }
    }
  }
  return move
}

// ── Cube View — layered flat grids in 3D space ───────────────
const CELL   = 56
const GAP    = 7
const GRID   = CELL * 3 + GAP * 2
const LAYER_Z = 84

const LAYER_TINT = [
  'rgba(230,57,70,0.07)',
  'rgba(26,26,46,0.04)',
  'rgba(59,130,246,0.07)',
]

function CubeBoard({ squares, winLine, playerTurn, onCellClick }) {
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
      style={{
        perspective: '1000px',
        width: GRID + 140, height: GRID + 140,
        margin: 'auto',
        cursor: dragRef.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div style={{
        width: GRID, height: GRID,
        margin: 70,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
      }}>
        {[0, 1, 2].map(layer => (
          <div key={layer} style={{
            position: 'absolute', top: 0, left: 0,
            width: GRID, height: GRID,
            transform: `translateZ(${(layer - 1) * LAYER_Z}px)`,
          }}>
            {/* Layer tint */}
            <div style={{
              position: 'absolute', inset: -6,
              background: LAYER_TINT[layer],
              border: '1px solid rgba(26,26,46,0.08)',
              borderRadius: 12, pointerEvents: 'none',
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
                const isWin = winLine.has(sqIdx)
                const isEmpty = !sq && playerTurn
                return (
                  <button key={i} onClick={() => onCellClick(sqIdx)} style={{
                    width: CELL, height: CELL,
                    fontSize: 20, fontWeight: 800,
                    cursor: isEmpty ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8,
                    border: isWin ? '2px solid #22c55e'
                      : sq === 'X' ? '2px solid rgba(230,57,70,0.45)'
                      : sq === 'O' ? '2px solid rgba(26,26,46,0.2)'
                      : '2px solid rgba(26,26,46,0.1)',
                    background: isWin ? 'rgba(187,247,208,0.92)'
                      : sq === 'X' ? 'rgba(254,226,226,0.88)'
                      : sq === 'O' ? 'rgba(226,232,240,0.88)'
                      : 'rgba(255,255,255,0.78)',
                    color: isWin ? '#15803d' : sq === 'X' ? '#e63946' : '#1a1a2e',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    transition: 'background 0.12s',
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
function LayerBoard({ squares, winLine, playerTurn, onCellClick }) {
  return (
    <div className="flex flex-wrap justify-center gap-8">
      {[0, 1, 2].map(layer => (
        <div key={layer} className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-ink/50 uppercase tracking-wider">Layer {layer + 1}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }, (_, i) => {
              const sqIdx = layer * 9 + i
              const sq = squares[sqIdx]
              const isWin = winLine.has(sqIdx)
              return (
                <button key={i} onClick={() => onCellClick(sqIdx)}
                  className={[
                    'w-16 h-16 text-2xl font-bold rounded-lg border-2 transition-all duration-150 flex items-center justify-center',
                    isWin ? 'border-green-500 bg-green-50 text-green-700'
                      : sq === 'X' ? 'text-accent border-accent/40 bg-accent/5'
                      : sq === 'O' ? 'text-ink border-ink/30 bg-canvas'
                      : playerTurn ? 'border-ink/20 bg-white hover:bg-canvas hover:border-ink/40 cursor-pointer'
                      : 'border-ink/10 bg-white cursor-default',
                  ].join(' ')}>
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

// ── Main component ───────────────────────────────────────────
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

export default function TicTacToe3D() {
  const [squares, setSquares] = useState(Array(27).fill(null))
  const [difficulty, setDifficulty] = useState('Hard')
  const [thinking, setThinking] = useState(false)
  const [viewMode, setViewMode] = useState('layer')
  const pendingRef = useRef(false)

  const result = checkWinner(squares)
  const winner = result?.winner
  const winLine = new Set(result?.line ?? [])
  const draw = !winner && squares.every(Boolean)
  const gameOver = winner || draw
  const playerTurn = !gameOver && !thinking && squares.filter(Boolean).length % 2 === 0

  useEffect(() => {
    const isComputerTurn = !gameOver && squares.filter(Boolean).length % 2 === 1
    if (isComputerTurn && !pendingRef.current) {
      pendingRef.current = true
      setThinking(true)
      const timer = setTimeout(() => {
        let move = -1
        const copy = [...squares]
        if (difficulty === 'Easy') move = easyMove(copy)
        else if (difficulty === 'Medium') move = mediumMove(copy)
        else move = hardMove(copy)
        if (move !== -1) {
          const next = [...squares]; next[move] = 'O'
          setSquares(next)
        }
        pendingRef.current = false
        setThinking(false)
      }, 150)
      return () => { clearTimeout(timer); pendingRef.current = false }
    }
  }, [squares, gameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(i) {
    if (!playerTurn || squares[i]) return
    const next = [...squares]; next[i] = 'X'
    setSquares(next)
  }

  function reset() {
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
  }

  function handleDifficulty(d) {
    setDifficulty(d); pendingRef.current = false
    setSquares(Array(27).fill(null)); setThinking(false)
  }

  let status
  if (winner === 'X') status = 'You win! 🎉'
  else if (winner === 'O') status = 'Computer wins 😔'
  else if (draw) status = 'Draw 🤝'
  else if (thinking) status = 'Computer thinking...'
  else status = `Your turn — ${difficulty} mode`

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <a href="#/" className="text-ink/50 hover:text-accent transition-colors text-sm font-medium">← Back</a>
          <h1 className="font-display text-2xl font-bold text-ink">3D Tic-Tac-Toe</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center gap-8">
        {/* Controls row */}
        <div className="flex flex-wrap justify-center gap-4">
          {/* View toggle */}
          <div className="flex rounded-lg border border-ink/20 overflow-hidden">
            {[['layer', '☰ Layers'], ['cube', '⬡ Cube']].map(([v, label]) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={['px-4 py-1.5 text-sm font-medium transition-colors',
                  viewMode === v ? 'bg-ink text-paper' : 'bg-paper text-ink/60 hover:bg-canvas'].join(' ')}>
                {label}
              </button>
            ))}
          </div>
          {/* Difficulty */}
          <div className="flex rounded-lg border border-ink/20 overflow-hidden">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => handleDifficulty(d)}
                className={['px-4 py-1.5 text-sm font-medium transition-colors',
                  difficulty === d ? 'bg-ink text-paper' : 'bg-paper text-ink/60 hover:bg-canvas'].join(' ')}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <p className="text-lg font-medium text-ink/70">{status}</p>

        {/* Board */}
        {viewMode === 'cube' ? (
          <div className="w-full flex flex-col items-center">
            <CubeBoard squares={squares} winLine={winLine} playerTurn={playerTurn} onCellClick={handleClick} />
            <p className="mt-4 text-xs text-ink/30">Drag to rotate</p>
          </div>
        ) : (
          <LayerBoard squares={squares} winLine={winLine} playerTurn={playerTurn} onCellClick={handleClick} />
        )}

        {gameOver && (
          <button onClick={reset} className="px-8 py-3 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors">
            Play again
          </button>
        )}

        <div className="flex gap-6 text-sm text-ink/50">
          <span><span className="text-accent font-bold">X</span> — You</span>
          <span><span className="font-bold">O</span> — Computer</span>
        </div>
        <p className="text-xs text-ink/30 text-center max-w-sm">
          49 winning lines — rows, columns, pillars, and diagonals across all 3 layers.
        </p>
      </main>
    </div>
  )
}
