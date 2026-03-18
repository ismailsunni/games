import { useState, useEffect, useRef } from 'react'
import { easyMove, mediumMove, hardMove } from '../utils/tictactoeAI'

const LS_KEY = 'tictactoe_state'

function generateWinLines(boardSize, winLength) {
  const lines = []
  const n = boardSize
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= n - winLength; c++) {
      const line = []; for (let k = 0; k < winLength; k++) line.push(r * n + c + k); lines.push(line)
    }
  for (let c = 0; c < n; c++)
    for (let r = 0; r <= n - winLength; r++) {
      const line = []; for (let k = 0; k < winLength; k++) line.push((r + k) * n + c); lines.push(line)
    }
  for (let r = 0; r <= n - winLength; r++)
    for (let c = 0; c <= n - winLength; c++) {
      const line = []; for (let k = 0; k < winLength; k++) line.push((r + k) * n + (c + k)); lines.push(line)
    }
  for (let r = 0; r <= n - winLength; r++)
    for (let c = winLength - 1; c < n; c++) {
      const line = []; for (let k = 0; k < winLength; k++) line.push((r + k) * n + (c - k)); lines.push(line)
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

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY))
    if (s && Array.isArray(s.squares)) return s
  } catch {}
  return null
}

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

export default function TicTacToe() {
  const saved = loadState()
  const [boardSize,    setBoardSize]    = useState(Math.max(3, saved?.boardSize ?? 3))
  const [winLength,    setWinLength]    = useState(saved?.winLength    ?? 3)
  const [difficulty,   setDifficulty]   = useState(saved?.difficulty   ?? 'Hard')
  const [computerFirst,setComputerFirst]= useState(saved?.computerFirst ?? false)
  const [squares,      setSquares]      = useState(saved?.squares      ?? Array(9).fill(null))
  const [thinking,     setThinking]     = useState(false)
  const pendingRef = useRef(false)

  // computerFirst: computer plays as X (odd-count = player's turn); player plays as O
  // playerFirst (default): player is X, computer is O
  // When computerFirst: X = computer, O = player
  // move count % 2 === 0 → X's turn
  // computerFirst → computer moves on even count, player on odd
  const moveCount  = squares.filter(Boolean).length
  const isComputerMove = computerFirst ? (moveCount % 2 === 0) : (moveCount % 2 === 1)
  const playerSymbol   = computerFirst ? 'O' : 'X'
  const computerSymbol = computerFirst ? 'X' : 'O'

  const winLines  = generateWinLines(boardSize, winLength)
  const winner    = checkWinner(squares, winLines)
  const draw      = isDraw(squares, winLines)
  const gameOver  = winner || draw
  const playerTurn = !gameOver && !thinking && !isComputerMove

  // Persist to localStorage whenever relevant state changes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ boardSize, winLength, difficulty, computerFirst, squares }))
  }, [boardSize, winLength, difficulty, computerFirst, squares])

  // Computer move effect
  useEffect(() => {
    if (!gameOver && isComputerMove && !pendingRef.current) {
      pendingRef.current = true
      setThinking(true)
      const timer = setTimeout(() => {
        let move = -1
        if (difficulty === 'Easy') move = easyMove([...squares], boardSize)
        else if (difficulty === 'Medium') move = mediumMove([...squares], boardSize, winLength)
        else move = hardMove([...squares], boardSize, winLength)
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

  function reset(opts = {}) {
    const size = opts.boardSize ?? boardSize
    pendingRef.current = false
    setThinking(false)
    setSquares(Array(size * size).fill(null))
  }

  function handleBoardSizeChange(e) {
    const newSize = parseInt(e.target.value)
    const newWin  = Math.min(winLength, newSize)
    setBoardSize(newSize)
    setWinLength(newWin)
    reset({ boardSize: newSize })
  }

  function handleWinLengthChange(e) {
    setWinLength(parseInt(e.target.value))
    reset()
  }

  function handleDifficultyChange(d) {
    setDifficulty(d)
    reset()
  }

  function handleComputerFirst(val) {
    setComputerFirst(val)
    if (!val) return
    // Directly trigger AI move on the empty board — can't rely on effect
    // since only computerFirst changes (squares doesn't)
    if (pendingRef.current) return
    pendingRef.current = true
    setThinking(true)
    const emptyBoard = Array(boardSize * boardSize).fill(null)
    setTimeout(() => {
      let move = -1
      if (difficulty === 'Easy') move = easyMove([...emptyBoard], boardSize)
      else if (difficulty === 'Medium') move = mediumMove([...emptyBoard], boardSize, winLength)
      else move = hardMove([...emptyBoard], boardSize, winLength)
      if (move !== -1) {
        const next = [...emptyBoard]
        next[move] = 'X' // computer plays X when going first
        setSquares(next)
      }
      pendingRef.current = false
      setThinking(false)
    }, 100)
  }

  function handleGiveUp() {
    // Treat as forfeit — fill a marker to trigger "computer wins" display
    // Easiest: just mark the result directly via a fake win state
    // We'll use a separate flag instead
    setGaveUp(true)
  }

  const [gaveUp, setGaveUp] = useState(false)
  const effectiveGameOver = gameOver || gaveUp

  let status
  if (gaveUp) status = 'You gave up 🏳️ Computer wins!'
  else if (winner === playerSymbol) status = 'You win! 🎉'
  else if (winner === computerSymbol) status = 'Computer wins 😔'
  else if (draw) status = 'Draw 🤝'
  else if (thinking) status = 'Computer thinking...'
  else status = `Your turn — ${difficulty} mode`

  const cellSize = Math.max(32, 96 - (boardSize - 3) * 12)
  const fontSize = Math.max(14, 36 - (boardSize - 3) * 5)

  function handleReset() {
    setGaveUp(false)
    setComputerFirst(false)
    reset()
  }

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-6 py-6">
        <div className="max-w-xl mx-auto flex items-center gap-4">
          <a href="#/" className="text-ink/50 hover:text-accent transition-colors text-sm font-medium">← Back</a>
          <h1 className="font-display text-2xl font-bold text-ink">Tic-Tac-Toe</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10 flex flex-col items-center gap-8">
        {/* Settings */}
        <div className="w-full bg-canvas rounded-xl p-4 border border-ink/10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/70 w-24 shrink-0">Board size:</span>
            <input type="range" min={3} max={10} value={boardSize} onChange={handleBoardSizeChange} className="flex-1 accent-accent" />
            <span className="text-sm font-medium text-ink w-16 text-right">{boardSize}×{boardSize}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/70 w-24 shrink-0">Win length:</span>
            <input type="range" min={2} max={boardSize} value={winLength} onChange={handleWinLengthChange} className="flex-1 accent-accent" />
            <span className="text-sm font-medium text-ink w-16 text-right">{winLength} in a row</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/70 w-24 shrink-0">Difficulty:</span>
            <div className="flex rounded-lg border border-ink/20 overflow-hidden">
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => handleDifficultyChange(d)}
                  className={['px-4 py-1.5 text-sm font-medium transition-colors',
                    difficulty === d ? 'bg-ink text-paper' : 'bg-paper text-ink/60 hover:bg-canvas'].join(' ')}>
                  {d}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Status */}
        <p className="text-lg font-medium text-ink/70">{status}</p>

        {/* Let AI go first — only on empty board */}
        {moveCount === 0 && !thinking && !effectiveGameOver && (
          <button
            onClick={() => handleComputerFirst(true)}
            className="text-sm text-ink/50 border border-ink/20 rounded-lg px-5 py-2 hover:border-accent hover:text-accent transition-colors"
          >
            🤖 Let AI go first
          </button>
        )}

        {/* Board */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${boardSize}, 1fr)`, gap: '8px' }}>
          {squares.map((sq, i) => (
            <button key={i} onClick={() => handleClick(i)}
              style={{ width: cellSize, height: cellSize, fontSize }}
              className={[
                'font-bold rounded-lg border-2 transition-all duration-150 flex items-center justify-center',
                sq === playerSymbol ? 'text-accent border-accent/40 bg-accent/5'
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
            <button onClick={handleReset}
              className="px-8 py-3 bg-ink text-paper font-medium rounded-lg hover:bg-ink/80 transition-colors">
              Play again
            </button>
          ) : moveCount > 0 && (
            <button onClick={handleGiveUp}
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
