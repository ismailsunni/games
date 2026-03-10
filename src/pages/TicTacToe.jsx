import { useState, useEffect } from 'react'

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
]

function checkWinner(squares) {
  for (const [a, b, c] of WINNING_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a]
    }
  }
  return null
}

function isDraw(squares) {
  return squares.every(Boolean) && !checkWinner(squares)
}

function minimax(squares, isMaximizing) {
  const winner = checkWinner(squares)
  if (winner === 'O') return 10
  if (winner === 'X') return -10
  if (squares.every(Boolean)) return 0

  if (isMaximizing) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (!squares[i]) {
        squares[i] = 'O'
        best = Math.max(best, minimax(squares, false))
        squares[i] = null
      }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < 9; i++) {
      if (!squares[i]) {
        squares[i] = 'X'
        best = Math.min(best, minimax(squares, true))
        squares[i] = null
      }
    }
    return best
  }
}

function bestMove(squares) {
  let best = -Infinity
  let move = -1
  for (let i = 0; i < 9; i++) {
    if (!squares[i]) {
      squares[i] = 'O'
      const score = minimax(squares, false)
      squares[i] = null
      if (score > best) {
        best = score
        move = i
      }
    }
  }
  return move
}

export default function TicTacToe() {
  const [squares, setSquares] = useState(Array(9).fill(null))
  const [thinking, setThinking] = useState(false)

  const winner = checkWinner(squares)
  const draw = isDraw(squares)
  const gameOver = winner || draw
  const playerTurn = !gameOver && !thinking && squares.filter(Boolean).length % 2 === 0

  useEffect(() => {
    // Computer's turn: when it's O's move
    if (!gameOver && !thinking && squares.filter(Boolean).length % 2 === 1) {
      setThinking(true)
      const timer = setTimeout(() => {
        const move = bestMove([...squares])
        if (move !== -1) {
          const next = [...squares]
          next[move] = 'O'
          setSquares(next)
        }
        setThinking(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [squares, gameOver, thinking])

  function handleClick(i) {
    if (!playerTurn || squares[i]) return
    const next = [...squares]
    next[i] = 'X'
    setSquares(next)
  }

  function reset() {
    setSquares(Array(9).fill(null))
    setThinking(false)
  }

  let status
  if (winner === 'X') status = 'You win! 🎉'
  else if (winner === 'O') status = 'Computer wins 😔'
  else if (draw) status = 'Draw 🤝'
  else if (thinking) status = 'Computer thinking...'
  else status = 'Your turn'

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
        {/* Status */}
        <div className="text-center">
          <p className="text-lg font-medium text-ink/70">{status}</p>
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-2">
          {squares.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={[
                'w-24 h-24 text-4xl font-bold rounded-lg border-2 transition-all duration-150',
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
