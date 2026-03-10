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

// ── Cube View — Rubik's style ─────────────────────────────────
const CS = 50      // cube face size (px)
const CG = 8       // gap between cubes
const CD = CS      // cube depth = same as face = perfect cube
const LAYER_Z = CS + CG  // z-step between layers
const GRID = CS * 3 + CG * 2  // total grid width/height

// One 3D cube cell
function RubikCell({ sq, isWin, isEmpty, onClick }) {
  const front  = isWin ? '#86efac' : sq === 'X' ? '#fca5a5' : sq === 'O' ? '#e2e8f0' : 'rgba(255,255,255,0.7)'
  const side   = 'rgba(26,26,46,0.18)'
  const h = CS / 2
  const faceStyle = (transform, bg, extra = {}) => ({
    position: 'absolute', width: CS, height: CS,
    background: bg, transform, ...extra,
  })
  return (
    <div
      onClick={onClick}
      style={{
        width: CS, height: CS,
        position: 'relative',
        transformStyle: 'preserve-3d',
        cursor: isEmpty ? 'pointer' : 'default',
      }}
    >
      {/* Front */}
      <div style={faceStyle(`translateZ(${h}px)`, front, {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: CS * 0.38, fontWeight: 800,
        color: sq === 'X' ? '#e63946' : '#1a1a2e',
        borderRadius: 4,
        border: '1.5px solid rgba(26,26,46,0.12)',
        boxSizing: 'border-box',
      })}>{sq}</div>
      {/* Back */}
      <div style={faceStyle(`rotateY(180deg) translateZ(${h}px)`, side, { borderRadius: 3 })} />
      {/* Left */}
      <div style={{ ...faceStyle('', side), width: CD, transformOrigin: 'left center', transform: `rotateY(-90deg) translateZ(0px)`, left: 0, borderRadius: 3 }} />
      {/* Right */}
      <div style={{ ...faceStyle('', side), width: CD, transformOrigin: 'right center', transform: `rotateY(90deg) translateZ(0px)`, right: 0, borderRadius: 3 }} />
      {/* Top */}
      <div style={{ ...faceStyle('', side), height: CD, transformOrigin: 'top center', transform: `rotateX(90deg) translateZ(0px)`, top: 0, borderRadius: 3 }} />
      {/* Bottom */}
      <div style={{ ...faceStyle('', side), height: CD, transformOrigin: 'bottom center', transform: `rotateX(-90deg) translateZ(0px)`, bottom: 0, borderRadius: 3 }} />
    </div>
  )
}

function CubeBoard({ squares, winLine, playerTurn, onCellClick }) {
  const [rotX, setRotX] = useState(-25)
  const [rotY, setRotY] = useState(30)
  const dragRef = useRef(null)
  const isDragging = !!dragRef.current

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, rotX, rotY }
  }
  function onPointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    setRotY(dragRef.current.rotY + dx * 0.5)
    setRotX(Math.max(-70, Math.min(70, dragRef.current.rotX - dy * 0.5)))
  }
  function onPointerUp() { dragRef.current = null }

  return (
    <div
      style={{
        perspective: '1000px',
        width: GRID + 120, height: GRID + 120,
        margin: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div style={{
        width: GRID, height: GRID,
        margin: 60,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease',
      }}>
        {[0, 1, 2].map(layer => (
          <div key={layer} style={{
            position: 'absolute', top: 0, left: 0,
            width: GRID, height: GRID,
            transformStyle: 'preserve-3d',
            // centre layer at z=0, others offset by ±LAYER_Z
            transform: `translateZ(${(layer - 1) * LAYER_Z}px)`,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(3, ${CS}px)`,
              gridTemplateRows: `repeat(3, ${CS}px)`,
              gap: CG,
              transformStyle: 'preserve-3d',
            }}>
              {Array.from({ length: 9 }, (_, i) => {
                const sqIdx = layer * 9 + i
                return (
                  <RubikCell
                    key={i}
                    sq={squares[sqIdx]}
                    isWin={winLine.has(sqIdx)}
                    isEmpty={!squares[sqIdx] && playerTurn}
                    onClick={() => onCellClick(sqIdx)}
                  />
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
