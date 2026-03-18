import { useState, useEffect, useRef } from 'react'
import { easyMove } from '../utils/tictactoeAI'

const BOARD_SIZE = 2
const WIN_LENGTH = 2
const LS_KEY = 'tictactwo_state'

function generateWinLines() {
  const lines = []
  const n = BOARD_SIZE
  // rows
  for (let r = 0; r < n; r++) {
    const line = []; for (let c = 0; c < n; c++) line.push(r * n + c); lines.push(line)
  }
  // cols
  for (let c = 0; c < n; c++) {
    const line = []; for (let r = 0; r < n; r++) line.push(r * n + c); lines.push(line)
  }
  // diagonals
  lines.push([0, 3])
  lines.push([1, 2])
  return lines
}

const WIN_LINES = generateWinLines()

function checkWinner(squares) {
  for (const line of WIN_LINES) {
    const first = squares[line[0]]
    if (first && line.every(i => squares[i] === first)) return first
  }
  return null
}

function isDraw(squares) {
  return squares.every(Boolean) && !checkWinner(squares)
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY))
    if (s && Array.isArray(s.squares)) return s
  } catch {}
  return null
}

export default function TicTacTwo() {
  const saved = loadState()
  const [computerFirst, setComputerFirst] = useState(saved?.computerFirst ?? false)
  const [squares,       setSquares]       = useState(saved?.squares       ?? Array(4).fill(null))
  const [gaveUp,        setGaveUp]        = useState(false)
  const [thinking,      setThinking]      = useState(false)
  const pendingRef = useRef(false)

  const moveCount        = squares.filter(Boolean).length
  const isComputerMove   = computerFirst ? (moveCount % 2 === 0) : (moveCount % 2 === 1)
  const playerSymbol     = computerFirst ? 'O' : 'X'
  const computerSymbol   = computerFirst ? 'X' : 'O'

  const winner           = checkWinner(squares)
  const draw             = isDraw(squares)
  const gameOver         = winner || draw
  const effectiveGameOver = gameOver || gaveUp
  const playerTurn       = !effectiveGameOver && !thinking && !isComputerMove

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ computerFirst, squares }))
  }, [computerFirst, squares])

  useEffect(() => {
    if (!gameOver && isComputerMove && !pendingRef.current) {
      pendingRef.current = true
      setThinking(true)
      const timer = setTimeout(() => {
        let move = easyMove([...squares], BOARD_SIZE)
        if (move !== -1) {
          const next = [...squares]
          next[move] = computerSymbol
          setSquares(next)
        }
        pendingRef.current = false
        setThinking(false)
      }, 100)
      return () => { clearTimeout(timer); pendingRef.current = false }
    }
  }, [squares, gameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick(i) {
    if (!playerTurn || squares[i]) return
    const next = [...squares]
    next[i] = playerSymbol
    setSquares(next)
  }

  function reset() {
    pendingRef.current = false
    setThinking(false)
    setGaveUp(false)
    setSquares(Array(4).fill(null))
  }

  function handleComputerFirst(val) {
    setComputerFirst(val)
    if (!val) return
    if (pendingRef.current) return
    pendingRef.current = true
    setThinking(true)
    const emptyBoard = Array(4).fill(null)
    setTimeout(() => {
      let move = easyMove([...emptyBoard], BOARD_SIZE)
      if (move !== -1) {
        const next = [...emptyBoard]
        next[move] = 'X'
        setSquares(next)
      }
      pendingRef.current = false
      setThinking(false)
    }, 100)
  }

  let status
  if (gaveUp) status = 'You gave up 🏳️ Computer wins!'
  else if (winner === playerSymbol) status = 'You win! 🎉'
  else if (winner === computerSymbol) status = 'Computer wins 😔'
  else if (draw) status = "It's a draw 🤝"
  else if (thinking) status = 'Computer thinking...'
  else status = 'Your turn'

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-6 py-6">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <a href="#/" className="text-ink/50 hover:text-accent transition-colors text-sm font-medium">← Back</a>
          <h1 className="font-display text-2xl font-bold text-ink">Tic-Tac-Two</h1>
          <span className="text-xs text-ink/40 border border-ink/20 rounded px-2 py-0.5">2×2</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10 flex flex-col items-center gap-8">
        <p className="text-xs text-ink/40">Fixed 2×2 board · first to get 2 in a row wins</p>

        {/* Status */}
        <p className="text-lg font-medium text-ink/70">{status}</p>

        {/* Let AI go first */}
        {moveCount === 0 && !thinking && !effectiveGameOver && (
          <button
            onClick={() => handleComputerFirst(true)}
            className="text-sm text-ink/50 border border-ink/20 rounded-lg px-5 py-2 hover:border-accent hover:text-accent transition-colors"
          >
            🤖 Let AI go first
          </button>
        )}

        {/* Board — large cells since it's 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {squares.map((sq, i) => (
            <button key={i} onClick={() => handleClick(i)}
              style={{ width: 120, height: 120, fontSize: 48 }}
              className={[
                'font-bold rounded-xl border-2 transition-all duration-150 flex items-center justify-center',
                sq === playerSymbol  ? 'text-accent border-accent/40 bg-accent/5'
                  : sq === computerSymbol ? 'text-ink border-ink/30 bg-canvas'
                  : playerTurn && !sq ? 'border-ink/20 bg-white hover:bg-canvas hover:border-ink/40 cursor-pointer'
                  : 'border-ink/10 bg-white cursor-default',
              ].join(' ')}>
              {sq}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap justify-center">
          {effectiveGameOver ? (
            <button onClick={reset}
              className="px-8 py-3 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors">
              Play again
            </button>
          ) : moveCount > 0 && (
            <button onClick={() => setGaveUp(true)}
              className="px-6 py-2.5 border-2 border-ink/20 text-ink/50 font-medium rounded-lg hover:border-accent hover:text-accent transition-colors text-sm">
              🏳️ Give up
            </button>
          )}
        </div>

        <div className="flex gap-6 text-sm text-ink/50">
          <span><span className="text-accent font-bold">{playerSymbol}</span> — You</span>
          <span><span className="font-bold">{computerSymbol}</span> — Computer</span>
        </div>
      </main>
    </div>
  )
}
