import { useState, useEffect, useRef } from 'react'

// Generate all winning lines of length `winLength` on an `n x n` board
function generateWinLines(boardSize, winLength) {
  const lines = []
  const n = boardSize

  // Rows
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - winLength; c++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push(r * n + c + k)
      lines.push(line)
    }
  }

  // Cols
  for (let c = 0; c < n; c++) {
    for (let r = 0; r <= n - winLength; r++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push((r + k) * n + c)
      lines.push(line)
    }
  }

  // Diagonals ↘
  for (let r = 0; r <= n - winLength; r++) {
    for (let c = 0; c <= n - winLength; c++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push((r + k) * n + (c + k))
      lines.push(line)
    }
  }

  // Diagonals ↙
  for (let r = 0; r <= n - winLength; r++) {
    for (let c = winLength - 1; c < n; c++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push((r + k) * n + (c - k))
      lines.push(line)
    }
  }

  return lines
}

function checkWinner(squares, winLines) {
  for (const line of winLines) {
    const first = squares[line[0]]
    if (first && line.every(i => squares[i] === first)) return first
  }
  return null
}

function isDraw(squares, winLines) {
  return squares.every(Boolean) && !checkWinner(squares, winLines)
}

// Heuristic: count open threat lines of length winLength-1 for each player
function evaluate(squares, winLines) {
  let score = 0
  for (const line of winLines) {
    const pieces = line.map(i => squares[i])
    const hasX = pieces.some(p => p === 'X')
    const hasO = pieces.some(p => p === 'O')
    if (hasO && !hasX) {
      const count = pieces.filter(p => p === 'O').length
      if (count === line.length - 1) score += 10
    } else if (hasX && !hasO) {
      const count = pieces.filter(p => p === 'X').length
      if (count === line.length - 1) score -= 10
    }
  }
  return score
}

// Full minimax — only used for 3×3
function minimaxFull(squares, winLines, size, isMaximizing) {
  const winner = checkWinner(squares, winLines)
  if (winner === 'O') return 10
  if (winner === 'X') return -10
  if (squares.every(Boolean)) return 0

  if (isMaximizing) {
    let best = -Infinity
    for (let i = 0; i < size; i++) {
      if (!squares[i]) {
        squares[i] = 'O'
        best = Math.max(best, minimaxFull(squares, winLines, size, false))
        squares[i] = null
      }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < size; i++) {
      if (!squares[i]) {
        squares[i] = 'X'
        best = Math.min(best, minimaxFull(squares, winLines, size, true))
        squares[i] = null
      }
    }
    return best
  }
}

// Alpha-beta minimax with depth limit and heuristic eval
function minimaxAB(squares, winLines, size, isMaximizing, alpha, beta, depth, maxDepth) {
  const winner = checkWinner(squares, winLines)
  if (winner === 'O') return 100 + depth
  if (winner === 'X') return -100 - depth
  if (squares.every(Boolean)) return 0
  if (depth >= maxDepth) return evaluate(squares, winLines)

  if (isMaximizing) {
    let best = -Infinity
    for (let i = 0; i < size; i++) {
      if (!squares[i]) {
        squares[i] = 'O'
        best = Math.max(best, minimaxAB(squares, winLines, size, false, alpha, beta, depth + 1, maxDepth))
        squares[i] = null
        alpha = Math.max(alpha, best)
        if (beta <= alpha) break
      }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < size; i++) {
      if (!squares[i]) {
        squares[i] = 'X'
        best = Math.min(best, minimaxAB(squares, winLines, size, true, alpha, beta, depth + 1, maxDepth))
        squares[i] = null
        beta = Math.min(beta, best)
        if (beta <= alpha) break
      }
    }
    return best
  }
}

function bestMove(squares, boardSize, winLength) {
  const winLines = generateWinLines(boardSize, winLength)
  const size = boardSize * boardSize
  let best = -Infinity
  let move = -1

  if (boardSize === 3) {
    for (let i = 0; i < size; i++) {
      if (!squares[i]) {
        squares[i] = 'O'
        const score = minimaxFull(squares, winLines, size, false)
        squares[i] = null
        if (score > best) { best = score; move = i }
      }
    }
  } else {
    const maxDepth = boardSize === 4 ? 6 : 4
    for (let i = 0; i < size; i++) {
      if (!squares[i]) {
        squares[i] = 'O'
        const score = minimaxAB(squares, winLines, size, false, -Infinity, Infinity, 0, maxDepth)
        squares[i] = null
        if (score > best) { best = score; move = i }
      }
    }
  }

  return move
}

export default function TicTacToe() {
  const [boardSize, setBoardSize] = useState(3)
  const [winLength, setWinLength] = useState(3)
  const [squares, setSquares] = useState(Array(9).fill(null))
  const [thinking, setThinking] = useState(false)
  const pendingRef = useRef(false)

  const winLines = generateWinLines(boardSize, winLength)
  const winner = checkWinner(squares, winLines)
  const draw = isDraw(squares, winLines)
  const gameOver = winner || draw
  const playerTurn = !gameOver && !thinking && squares.filter(Boolean).length % 2 === 0

  useEffect(() => {
    // Computer's turn: odd number of filled squares = O's move
    const isComputerTurn = !gameOver && squares.filter(Boolean).length % 2 === 1
    if (isComputerTurn && !pendingRef.current) {
      pendingRef.current = true
      setThinking(true)
      const timer = setTimeout(() => {
        const move = bestMove([...squares], boardSize, winLength)
        if (move !== -1) {
          const next = [...squares]
          next[move] = 'O'
          setSquares(next)
        }
        pendingRef.current = false
        setThinking(false)
      }, 100)
      return () => {
        clearTimeout(timer)
        pendingRef.current = false
      }
    }
  }, [squares, gameOver]) // intentionally excludes `thinking` to avoid cancelling the timer on re-render

  function handleClick(i) {
    if (!playerTurn || squares[i]) return
    const next = [...squares]
    next[i] = 'X'
    setSquares(next)
  }

  function handleBoardSizeChange(e) {
    const newSize = parseInt(e.target.value)
    const newWin = Math.min(winLength, newSize)
    setBoardSize(newSize)
    setWinLength(newWin)
    pendingRef.current = false
    setSquares(Array(newSize * newSize).fill(null))
    setThinking(false)
  }

  function handleWinLengthChange(e) {
    const newWin = parseInt(e.target.value)
    setWinLength(newWin)
    pendingRef.current = false
    setSquares(Array(boardSize * boardSize).fill(null))
    setThinking(false)
  }

  function reset() {
    pendingRef.current = false
    setSquares(Array(boardSize * boardSize).fill(null))
    setThinking(false)
  }

  let status
  if (winner === 'X') status = 'You win! 🎉'
  else if (winner === 'O') status = 'Computer wins 😔'
  else if (draw) status = 'Draw 🤝'
  else if (thinking) status = 'Computer thinking...'
  else status = 'Your turn'

  const cellSize = Math.max(32, 96 - (boardSize - 3) * 12)
  const fontSize = Math.max(14, 36 - (boardSize - 3) * 5)

  return (
    <div className="min-h-screen bg-paper font-body">
      {/* Header */}
      <header className="border-b border-ink/10 bg-canvas px-6 py-6">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <a
            href="#/"
            className="text-ink/50 hover:text-accent transition-colors text-sm font-medium"
          >
            ← Back
          </a>
          <h1 className="font-display text-2xl font-bold text-ink">Tic-Tac-Toe</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10 flex flex-col items-center gap-8">
        {/* Settings */}
        <div className="w-full bg-canvas rounded-xl p-4 border border-ink/10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/70 w-24 shrink-0">Board size:</span>
            <input
              type="range"
              min={2}
              max={10}
              value={boardSize}
              onChange={handleBoardSizeChange}
              className="flex-1 accent-accent"
            />
            <span className="text-sm font-medium text-ink w-16 text-right">{boardSize}×{boardSize}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/70 w-24 shrink-0">Win length:</span>
            <input
              type="range"
              min={2}
              max={boardSize}
              value={winLength}
              onChange={handleWinLengthChange}
              className="flex-1 accent-accent"
            />
            <span className="text-sm font-medium text-ink w-16 text-right">{winLength} in a row</span>
          </div>
        </div>

        {/* Status */}
        <div className="text-center">
          <p className="text-lg font-medium text-ink/70">{status}</p>
        </div>

        {/* Board */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
            gap: '8px',
          }}
        >
          {squares.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              style={{ width: cellSize, height: cellSize, fontSize }}
              className={[
                'font-bold rounded-lg border-2 transition-all duration-150',
                'flex items-center justify-center',
                sq === 'X'
                  ? 'text-accent border-accent/40 bg-accent/5'
                  : sq === 'O'
                  ? 'text-ink border-ink/30 bg-canvas'
                  : playerTurn && !sq
                  ? 'border-ink/20 bg-white hover:bg-canvas hover:border-ink/40 cursor-pointer'
                  : 'border-ink/10 bg-white cursor-default',
              ].join(' ')}
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Play again */}
        {gameOver && (
          <button
            onClick={reset}
            className="px-8 py-3 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors"
          >
            Play again
          </button>
        )}

        {/* Legend */}
        <div className="flex gap-6 text-sm text-ink/50">
          <span><span className="text-accent font-bold">X</span> — You</span>
          <span><span className="font-bold">O</span> — Computer</span>
        </div>
      </main>
    </div>
  )
}
