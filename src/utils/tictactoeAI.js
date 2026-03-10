// Generate all winning lines of length `winLength` on an `n x n` board
function generateWinLines(boardSize, winLength) {
  const lines = []
  const n = boardSize

  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - winLength; c++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push(r * n + c + k)
      lines.push(line)
    }
  }

  for (let c = 0; c < n; c++) {
    for (let r = 0; r <= n - winLength; r++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push((r + k) * n + c)
      lines.push(line)
    }
  }

  for (let r = 0; r <= n - winLength; r++) {
    for (let c = 0; c <= n - winLength; c++) {
      const line = []
      for (let k = 0; k < winLength; k++) line.push((r + k) * n + (c + k))
      lines.push(line)
    }
  }

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

// Heuristic evaluation for minimax
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

// Count how many winning threats a player would have if they placed at index `idx`
function countThreats(squares, winLines, idx, player) {
  const copy = [...squares]
  copy[idx] = player
  let threats = 0
  for (const line of winLines) {
    if (!line.includes(idx)) continue
    const pieces = line.map(i => copy[i])
    const opponent = player === 'O' ? 'X' : 'O'
    if (pieces.some(p => p === opponent)) continue
    const count = pieces.filter(p => p === player).length
    if (count >= line.length - 1) threats++
  }
  return threats
}

// Easy: random valid move
export function easyMove(squares, boardSize) {
  const empty = []
  for (let i = 0; i < boardSize * boardSize; i++) {
    if (!squares[i]) empty.push(i)
  }
  if (empty.length === 0) return -1
  return empty[Math.floor(Math.random() * empty.length)]
}

// Medium: threat-aware heuristic, no tree search
export function mediumMove(squares, boardSize, winLength) {
  const winLines = generateWinLines(boardSize, winLength)
  const size = boardSize * boardSize
  const n = boardSize

  // Center and corner/edge bonuses
  const center = Math.floor(n / 2) * n + Math.floor(n / 2)
  const corners = new Set([0, n - 1, (n - 1) * n, n * n - 1])

  let bestScore = -Infinity
  let bestMove = -1

  for (let i = 0; i < size; i++) {
    if (squares[i]) continue

    let score = 0

    // 1. Immediate win for O
    const testO = [...squares]
    testO[i] = 'O'
    if (checkWinner(testO, winLines) === 'O') {
      score = 10000
    } else {
      // 2. Block immediate win for X
      const testX = [...squares]
      testX[i] = 'X'
      if (checkWinner(testX, winLines) === 'X') {
        score = 9000
      } else {
        // 3. Create fork (2+ threats for O)
        const oThreats = countThreats(squares, winLines, i, 'O')
        if (oThreats >= 2) {
          score = 5000 + oThreats * 10
        } else {
          // 4. Block fork (2+ threats for X)
          const xThreats = countThreats(squares, winLines, i, 'X')
          if (xThreats >= 2) {
            score = 4000 + xThreats * 10
          } else {
            // 5. Build threat: score open lines through this square
            for (const line of winLines) {
              if (!line.includes(i)) continue
              const pieces = line.map(j => squares[j])
              if (pieces.some(p => p === 'X')) continue
              const oCount = pieces.filter(p => p === 'O').length
              score += (oCount + 1) * 10
            }

            // 6. Position preference
            if (i === center) score += 50
            else if (corners.has(i)) score += 30
            else score += 10
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMove = i
    }
  }

  return bestMove
}

// Hard: minimax + alpha-beta (existing behavior)
export function hardMove(squares, boardSize, winLength) {
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
