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

// Returns { winner, lines[] } where lines is array of all completed lines for the winner
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

// Returns { xCells, oCells } — Sets of cell indices in any completed line (for live highlighting)
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

function easyMove(squares, cpuMark) {
  const empty = squares.map((v, i) => v ? null : i).filter(i => i !== null)
  return empty[Math.floor(Math.random() * empty.length)] ?? -1
}

function mediumMove(squares, linesToWin, cpuMark, playerMark) {
  // Try to win
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    const t = [...squares]; t[i] = cpuMark
    if (checkWinner(t, linesToWin)?.winner === cpuMark) return i
  }
  // Block opponent win
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
      if (!vals.includes(cpuMark)) s -= vals.filter(v => v === playerMark).length
    }
    if (s > best) { best = s; move = i }
  }
  return move === -1 ? easyMove(squares, cpuMark) : move
}

function minimaxAB(squares, isMax, alpha, beta, depth, linesToWin, cpuMark, playerMark) {
  const result = checkWinner(squares, linesToWin)
  if (result?.winner === cpuMark) return 10 + depth
  if (result?.winner === playerMark) return -10 - depth
  if (squares.every(Boolean)) return 0
  if (depth <= 0) {
    let s = 0
    for (const line of WIN_LINES) {
      const vals = line.map(i => squares[i])
      if (!vals.includes(playerMark) && vals.includes(cpuMark)) s += vals.filter(v => v === cpuMark).length
      if (!vals.includes(cpuMark) && vals.includes(playerMark)) s -= vals.filter(v => v === playerMark).length
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

function cellStyle(sq, xCells, oCells, sqIdx, playerTurn) {
  const inXLine = xCells.has(sqIdx)
  const inOLine = oCells.has(sqIdx)
  const isEmpty = !sq && playerTurn

  let border, background, color
  if (inXLine) {
    border = '2px solid #22c55e'
    background = 'rgba(187,247,208,0.92)'
    color = '#15803d'
  } else if (inOLine) {
    border = '2px solid #3b82f6'
    background = 'rgba(219,234,254,0.92)'
    color = '#1d4ed8'
  } else if (sq === 'X') {
    border = '2px solid rgba(230,57,70,0.45)'
    background = 'rgba(254,226,226,0.88)'
    color = '#e63946'
  } else if (sq === 'O') {
    border = '2px solid rgba(26,26,46,0.2)'
    background = 'rgba(226,232,240,0.88)'
    color = '#1a1a2e'
  } else {
    border = '2px solid rgba(26,26,46,0.1)'
    background = 'rgba(255,255,255,0.78)'
    color = '#1a1a2e'
  }
  return { border, background, color, cursor: isEmpty ? 'pointer' : 'default' }
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
                const s = cellStyle(sq, xCells, oCells, sqIdx, playerTurn)
                return (
                  <button key={i} onClick={() => onCellClick(sqIdx)} style={{
                    width: CELL, height: CELL,
                    fontSize: 20, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8,
                    border: s.border, background: s.background, color: s.color,
                    cursor: s.cursor,
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
function layerCellClass(sq, xCells, oCells, sqIdx, playerTurn) {
  const inXLine = xCells.has(sqIdx)
  const inOLine = oCells.has(sqIdx)
  if (inXLine) return 'border-green-500 bg-green-50 text-green-700'
  if (inOLine) return 'border-blue-500 bg-blue-50 text-blue-700'
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
                  className={[
                    'w-16 h-16 text-2xl font-bold rounded-lg border-2 transition-all duration-150 flex items-center justify-center',
                    layerCellClass(sq, xCells, oCells, sqIdx, playerTurn),
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

// ── Line progress indicator ──────────────────────────────────
function LineProgress({ squares, linesToWin, playerMark, cpuMark }) {
  const xCount = WIN_LINES.filter(line => {
    const [a, b, c] = line
    return squares[a] === 'X' && squares[b] === 'X' && squares[c] === 'X'
  }).length
  const oCount = WIN_LINES.filter(line => {
    const [a, b, c] = line
    return squares[a] === 'O' && squares[b] === 'O' && squares[c] === 'O'
  }).length

  const playerCount = playerMark === 'X' ? xCount : oCount
  const cpuCount    = cpuMark    === 'X' ? xCount : oCount

  return (
    <div className="flex gap-8 text-sm">
      <div className="flex flex-col items-center gap-1">
        <span className="text-accent font-bold">You ({playerMark})</span>
        <div className="flex gap-1">
          {Array.from({ length: linesToWin }, (_, i) => (
            <div key={i} className={[
              'w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold',
              i < playerCount ? 'border-green-500 bg-green-50 text-green-700' : 'border-ink/20 bg-white text-ink/20'
            ].join(' ')}>
              {i < playerCount ? '✓' : '·'}
            </div>
          ))}
        </div>
        <span className="text-ink/40 text-xs">{playerCount}/{linesToWin} lines</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-bold">CPU ({cpuMark})</span>
        <div className="flex gap-1">
          {Array.from({ length: linesToWin }, (_, i) => (
            <div key={i} className={[
              'w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold',
              i < cpuCount ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-ink/20 bg-white text-ink/20'
            ].join(' ')}>
              {i < cpuCount ? '✓' : '·'}
            </div>
          ))}
        </div>
        <span className="text-ink/40 text-xs">{cpuCount}/{linesToWin} lines</span>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────
const DIFFICULTIES  = ['Easy', 'Medium', 'Hard']
const LINES_OPTIONS = [1, 2, 3, 4]

export default function TicTacToe3D() {
  const [squares, setSquares]         = useState(Array(27).fill(null))
  const [difficulty, setDifficulty]   = useState('Hard')
  const [linesToWin, setLinesToWin]   = useState(2)
  const [computerFirst, setComputerFirst] = useState(false)
  const [thinking, setThinking]       = useState(false)
  const [viewMode, setViewMode]       = useState('layer')
  const pendingRef = useRef(false)

  // Who plays which mark
  const playerMark = computerFirst ? 'O' : 'X'
  const cpuMark    = computerFirst ? 'X' : 'O'

  const result   = checkWinner(squares, linesToWin)
  const winner   = result?.winner
  const draw     = !winner && squares.every(Boolean)
  const gameOver = winner || draw

  // CPU goes on even move counts when computerFirst, odd otherwise
  const moveCount       = squares.filter(Boolean).length
  const isComputerTurn  = !gameOver && !thinking && (moveCount % 2 === (computerFirst ? 0 : 1))
  const playerTurn      = !gameOver && !thinking && !isComputerTurn

  // Completed line cells for live highlighting
  const { xCells, oCells } = getCompletedLineCells(squares)

  useEffect(() => {
    if (isComputerTurn && !pendingRef.current) {
      pendingRef.current = true
      setThinking(true)
      const timer = setTimeout(() => {
        let move = -1
        const copy = [...squares]
        if (difficulty === 'Easy')        move = easyMove(copy, cpuMark)
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
  }, [squares, gameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(i) {
    if (!playerTurn || squares[i]) return
    const next = [...squares]; next[i] = playerMark
    setSquares(next)
  }

  function reset() {
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
  }

  function handleDifficulty(d) {
    setDifficulty(d)
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
  }

  function handleLinesToWin(n) {
    setLinesToWin(n)
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
  }

  function handleComputerFirst(val) {
    setComputerFirst(val)
    pendingRef.current = false
    setSquares(Array(27).fill(null))
    setThinking(false)
  }

  let status
  if (winner === playerMark)      status = 'You win! 🎉'
  else if (winner === cpuMark)    status = 'Computer wins 😔'
  else if (draw)                  status = 'Draw 🤝'
  else if (thinking)              status = 'Computer thinking...'
  else                            status = `Your turn — ${difficulty} mode`

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <a href="#/" className="text-ink/50 hover:text-accent transition-colors text-sm font-medium">← Back</a>
          <h1 className="font-display text-2xl font-bold text-ink">Tic-Tac-Three-D</h1>
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

          {/* Who goes first */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/50 font-medium">First:</span>
            <div className="flex rounded-lg border border-ink/20 overflow-hidden">
              {[['you', 'You'], ['cpu', 'Computer']].map(([v, label]) => (
                <button key={v} onClick={() => handleComputerFirst(v === 'cpu')}
                  className={['px-4 py-1.5 text-sm font-medium transition-colors',
                    (v === 'cpu') === computerFirst ? 'bg-ink text-paper' : 'bg-paper text-ink/60 hover:bg-canvas'].join(' ')}>
                  {label}
                </button>
              ))}
            </div>
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

          {/* Lines to win */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/50 font-medium">Lines to win:</span>
            <div className="flex rounded-lg border border-ink/20 overflow-hidden">
              {LINES_OPTIONS.map(n => (
                <button key={n} onClick={() => handleLinesToWin(n)}
                  className={['px-4 py-1.5 text-sm font-medium transition-colors',
                    linesToWin === n ? 'bg-accent text-paper' : 'bg-paper text-ink/60 hover:bg-canvas'].join(' ')}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status */}
        <p className="text-lg font-medium text-ink/70">{status}</p>

        {/* Line progress */}
        {!gameOver && (
          <LineProgress squares={squares} linesToWin={linesToWin} playerMark={playerMark} cpuMark={cpuMark} />
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

        {gameOver && (
          <button onClick={reset} className="px-8 py-3 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors">
            Play again
          </button>
        )}

        <div className="flex gap-6 text-sm text-ink/50">
          <span><span className="text-accent font-bold">{playerMark}</span> — You</span>
          <span><span className="font-bold">{cpuMark}</span> — Computer</span>
        </div>
        <p className="text-xs text-ink/30 text-center max-w-sm">
          49 winning lines — rows, columns, pillars, and diagonals across all 3 layers.
          First to complete <strong>{linesToWin}</strong> line{linesToWin > 1 ? 's' : ''} wins.
          {linesToWin === 4 && ' 🔥 Tip: the center cell sits in 13 lines!'}
        </p>
      </main>
    </div>
  )
}
