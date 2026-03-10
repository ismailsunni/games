import { useState, useEffect, useRef } from 'react'

// Index: layer * 9 + row * 3 + col
function idx(l, r, c) { return l * 9 + r * 3 + c }

function generateWinLines() {
  const lines = []
  // Within each layer: rows, cols, diagonals
  for (let l = 0; l < 3; l++) {
    for (let i = 0; i < 3; i++) {
      lines.push([idx(l,i,0), idx(l,i,1), idx(l,i,2)]) // row
      lines.push([idx(l,0,i), idx(l,1,i), idx(l,2,i)]) // col
    }
    lines.push([idx(l,0,0), idx(l,1,1), idx(l,2,2)]) // diag
    lines.push([idx(l,0,2), idx(l,1,1), idx(l,2,0)]) // anti-diag
  }
  // Vertical pillars (same r,c across all layers)
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      lines.push([idx(0,r,c), idx(1,r,c), idx(2,r,c)])
  // Cross-layer diagonals: fix col, diag row+layer
  for (let c = 0; c < 3; c++) {
    lines.push([idx(0,0,c), idx(1,1,c), idx(2,2,c)])
    lines.push([idx(0,2,c), idx(1,1,c), idx(2,0,c)])
  }
  // Cross-layer diagonals: fix row, diag col+layer
  for (let r = 0; r < 3; r++) {
    lines.push([idx(0,r,0), idx(1,r,1), idx(2,r,2)])
    lines.push([idx(0,r,2), idx(1,r,1), idx(2,r,0)])
  }
  // Space diagonals (all 3 coords change)
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

// Easy: random
function easyMove(squares) {
  const empty = squares.map((v, i) => v ? null : i).filter(i => i !== null)
  return empty[Math.floor(Math.random() * empty.length)] ?? -1
}

// Medium: threat-aware heuristic
function mediumMove(squares) {
  const score = (sq, player) => {
    let s = 0
    for (const line of WIN_LINES) {
      const vals = line.map(i => sq[i])
      const opp = player === 'O' ? 'X' : 'O'
      if (vals.includes(opp)) continue
      s += vals.filter(v => v === player).length
    }
    return s
  }
  let best = -Infinity, move = -1
  for (let i = 0; i < 27; i++) {
    if (squares[i]) continue
    const t = [...squares]
    t[i] = 'O'
    if (checkWinner(t)?.winner === 'O') return i
    t[i] = 'X'
    if (checkWinner(t)?.winner === 'X') { move = i; best = 9000; continue }
    t[i] = 'O'
    const s = score(t, 'O') - score(t, 'X') * 0.9
    if (s > best) { best = s; move = i }
  }
  return move === -1 ? easyMove(squares) : move
}

// Hard: alpha-beta minimax, depth 5
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

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

export default function TicTacToe3D() {
  const [squares, setSquares] = useState(Array(27).fill(null))
  const [difficulty, setDifficulty] = useState('Hard')
  const [thinking, setThinking] = useState(false)
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
          const next = [...squares]
          next[move] = 'O'
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
    const next = [...squares]
    next[i] = 'X'
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
        {/* Difficulty */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink/70">Difficulty:</span>
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

        {/* 3 layers */}
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
                    <button key={i} onClick={() => handleClick(sqIdx)}
                      className={['w-16 h-16 text-2xl font-bold rounded-lg border-2 transition-all duration-150 flex items-center justify-center',
                        isWin ? 'border-green-500 bg-green-50'
                          : sq === 'X' ? 'text-accent border-accent/40 bg-accent/5'
                          : sq === 'O' ? 'text-ink border-ink/30 bg-canvas'
                          : playerTurn ? 'border-ink/20 bg-white hover:bg-canvas hover:border-ink/40 cursor-pointer'
                          : 'border-ink/10 bg-white cursor-default',
                        isWin && sq === 'X' ? 'text-accent' : '',
                        isWin && sq === 'O' ? 'text-ink' : '',
                      ].join(' ')}>
                      {sq}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

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
          Get 3 in a row within a layer, across layers (pillars), or diagonally through all 3 layers. 49 winning lines total.
        </p>
      </main>
    </div>
  )
}
