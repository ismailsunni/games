import { useState, useCallback } from 'react'

// ── Geometry helpers ─────────────────────────────────────────
function dist(a, b) {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y))
}

function routeCost(nodes, route) {
  let cost = 0
  for (let i = 0; i < route.length - 1; i++) cost += dist(nodes[route[i]], nodes[route[i + 1]])
  return cost
}

// ── Node placement: random with min separation ───────────────
const SVG_W = 400, SVG_H = 380
const PAD = 40, MIN_SEP = 70

function generateNodes(n) {
  const nodes = []
  let attempts = 0
  while (nodes.length < n && attempts < 2000) {
    attempts++
    const x = PAD + Math.random() * (SVG_W - PAD * 2)
    const y = PAD + Math.random() * (SVG_H - PAD * 2)
    if (nodes.every(p => Math.hypot(p.x - x, p.y - y) >= MIN_SEP)) {
      nodes.push({ x: Math.round(x), y: Math.round(y) })
    }
  }
  return nodes
}

// ── TSP solver: brute force (n ≤ 7 → ≤ 720 perms) ──────────
function permutations(arr) {
  if (arr.length <= 1) return [arr]
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const perm of permutations(rest)) result.push([arr[i], ...perm])
  }
  return result
}

function solveOptimal(nodes) {
  const n = nodes.length
  const indices = Array.from({ length: n - 1 }, (_, i) => i + 1) // fix node 0 as start
  const perms = permutations(indices)
  let best = Infinity, bestRoute = null
  for (const perm of perms) {
    const route = [0, ...perm, 0]
    const cost = routeCost(nodes, route)
    if (cost < best) { best = cost; bestRoute = route }
  }
  return { route: bestRoute, cost: best }
}

// ── Storage ──────────────────────────────────────────────────
const S_STATS = 'tsp_stats'

function loadStats() {
  try {
    const s = localStorage.getItem(S_STATS)
    return s ? JSON.parse(s) : { gamesPlayed: 0, optimalCount: 0, bestEfficiency: 0, totalEfficiency: 0 }
  } catch { return { gamesPlayed: 0, optimalCount: 0, bestEfficiency: 0, totalEfficiency: 0 } }
}
function saveStats(s) { localStorage.setItem(S_STATS, JSON.stringify(s)) }

// ── Graph SVG ────────────────────────────────────────────────
const NODE_R = 18
const NODE_LABELS = 'ABCDEFG'

function GraphSVG({ nodes, userRoute, optRoute, phase, onNodeClick, activeNode }) {
  const n = nodes.length
  const showOpt   = phase === 'result'
  const showUser  = userRoute.length >= 2
  const isPlaying = phase === 'playing'

  // Build edge list (unique pairs)
  const edges = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      edges.push([i, j, dist(nodes[i], nodes[j])])

  // Convert route to path segments
  function routeToSegs(route) {
    const segs = []
    for (let i = 0; i < route.length - 1; i++)
      segs.push([route[i], route[i + 1]])
    return segs
  }

  const userSegs = routeToSegs(userRoute)
  const optSegs  = showOpt ? routeToSegs(optRoute) : []

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-md mx-auto">
      {/* All edges */}
      {edges.map(([i, j, w]) => {
        const a = nodes[i], b = nodes[j]
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        return (
          <g key={`e-${i}-${j}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#d1d5db" strokeWidth="1.5" />
            <rect x={mx - 14} y={my - 9} width={28} height={18} rx={4}
              fill="white" fillOpacity="0.85" />
            <text x={mx} y={my + 5} textAnchor="middle"
              fontSize="10" fill="#6b7280" fontWeight="500">
              {w}
            </text>
          </g>
        )
      })}

      {/* Optimal route (green, shown on result) */}
      {optSegs.map(([i, j], k) => (
        <line key={`opt-${k}`}
          x1={nodes[i].x} y1={nodes[i].y} x2={nodes[j].x} y2={nodes[j].y}
          stroke="#22c55e" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      ))}

      {/* User route (accent color) */}
      {userSegs.map(([i, j], k) => (
        <line key={`usr-${k}`}
          x1={nodes[i].x} y1={nodes[i].y} x2={nodes[j].x} y2={nodes[j].y}
          stroke="#e63946" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
      ))}

      {/* Nodes */}
      {nodes.map((p, i) => {
        const isVisited  = userRoute.includes(i)
        const isActive   = activeNode === i
        const isNext     = isPlaying && !isVisited && activeNode !== i
        const isStart    = userRoute[0] === i
        const canClose   = isPlaying && isStart && userRoute.length === n + 1 - 1 // visited all, can return

        let fill = '#f3f4f6', stroke = '#9ca3af', textFill = '#374151'
        if (isActive)       { fill = '#e63946'; stroke = '#e63946'; textFill = '#fff' }
        else if (isVisited) { fill = '#fecaca'; stroke = '#e63946'; textFill = '#e63946' }
        if (canClose && isStart) { stroke = '#22c55e'; fill = '#dcfce7'; textFill = '#15803d' }

        return (
          <g key={i} onClick={() => isPlaying && onNodeClick(i)}
            style={{ cursor: isPlaying ? 'pointer' : 'default' }}>
            <circle cx={p.x} cy={p.y} r={NODE_R}
              fill={fill} stroke={stroke} strokeWidth="2.5"
              opacity={isNext || isVisited || isActive ? 1 : 0.85}
            />
            {isPlaying && !isVisited && !isActive && (
              <circle cx={p.x} cy={p.y} r={NODE_R}
                fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
            )}
            <text x={p.x} y={p.y + 5} textAnchor="middle"
              fontSize="13" fontWeight="700" fill={textFill} style={{ pointerEvents: 'none' }}>
              {NODE_LABELS[i]}
            </text>
            {/* Visit order badge */}
            {isVisited && userRoute.indexOf(i) > 0 && (
              <text x={p.x + NODE_R - 2} y={p.y - NODE_R + 6}
                textAnchor="middle" fontSize="9" fontWeight="700" fill="#e63946">
                {userRoute.indexOf(i)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Config modal ─────────────────────────────────────────────
function ConfigModal({ nodeCount, setNodeCount, onGenerate, onPlay, nodes, stats }) {
  const difficulties = { 3:'Easy', 4:'Easy+', 5:'Medium', 6:'Hard', 7:'Expert' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="text-center">
          <div className="text-4xl mb-1">🗺️</div>
          <h2 className="font-display text-xl font-bold text-ink">TSP Game</h2>
          <p className="text-xs text-ink/50 mt-1">Find the shortest route visiting all cities</p>
        </div>

        {/* Node count */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Cities</span>
            <span className="text-sm font-bold text-accent">{nodeCount} — {difficulties[nodeCount]}</span>
          </div>
          <input type="range" min={3} max={7} value={nodeCount}
            onChange={e => setNodeCount(+e.target.value)}
            className="w-full accent-accent" />
          <div className="flex justify-between text-xs text-ink/30">
            <span>3 Easy</span><span>7 Expert</span>
          </div>
        </div>

        {/* Preview graph */}
        {nodes && (
          <div className="border border-ink/10 rounded-xl overflow-hidden bg-paper">
            <GraphSVG nodes={nodes} userRoute={[]} optRoute={[]} phase="preview" onNodeClick={() => {}} activeNode={null} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button onClick={onGenerate}
            className="w-full border border-ink/20 text-ink font-medium py-2.5 rounded-xl text-sm hover:border-accent hover:text-accent transition-colors">
            🔄 Re-roll graph
          </button>
          <button onClick={onPlay}
            className="w-full bg-accent text-white font-bold py-3 rounded-xl text-base hover:opacity-90 transition-opacity">
            Play →
          </button>
        </div>

        {/* Mini stats */}
        {stats.gamesPlayed > 0 && (
          <div className="flex justify-around text-center border-t border-ink/10 pt-4">
            <div>
              <div className="font-bold text-ink">{stats.gamesPlayed}</div>
              <div className="text-xs text-ink/40">Played</div>
            </div>
            <div>
              <div className="font-bold text-green-600">{stats.optimalCount}</div>
              <div className="text-xs text-ink/40">Optimal</div>
            </div>
            <div>
              <div className="font-bold text-accent">{stats.gamesPlayed > 0 ? Math.round(stats.totalEfficiency / stats.gamesPlayed) : 0}%</div>
              <div className="text-xs text-ink/40">Avg score</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stats modal ──────────────────────────────────────────────
function StatsModal({ stats, onClose, onReset }) {
  const avg = stats.gamesPlayed > 0 ? Math.round(stats.totalEfficiency / stats.gamesPlayed) : 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Stats</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Games played', value: stats.gamesPlayed, color: 'text-ink' },
            { label: 'Optimal',      value: stats.optimalCount, color: 'text-green-600' },
            { label: 'Best score',   value: `${stats.bestEfficiency}%`, color: 'text-accent' },
            { label: 'Avg score',    value: `${avg}%`, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-paper rounded-xl p-3 flex flex-col gap-0.5">
              <span className={`text-2xl font-bold ${color}`}>{value}</span>
              <span className="text-xs text-ink/50">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-ink/60">Optimal rate</span>
            <span className="font-bold">{stats.gamesPlayed > 0 ? Math.round((stats.optimalCount / stats.gamesPlayed) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-ink/10 rounded-full h-2">
            <div className="h-full bg-green-500 rounded-full"
              style={{ width: `${stats.gamesPlayed > 0 ? (stats.optimalCount / stats.gamesPlayed) * 100 : 0}%` }} />
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

// ── Result screen ────────────────────────────────────────────
function ResultScreen({ nodes, userRoute, optimal, onPlayAgain, onSettings }) {
  const userCost = routeCost(nodes, userRoute)
  const efficiency = Math.round((optimal.cost / userCost) * 100)
  const isOptimal = userCost === optimal.cost

  let verdict, verdictColor
  if (isOptimal)          { verdict = '🏆 Optimal!';    verdictColor = 'text-green-600' }
  else if (efficiency >= 90) { verdict = '⭐ Near perfect'; verdictColor = 'text-blue-600' }
  else if (efficiency >= 75) { verdict = '👍 Good route';  verdictColor = 'text-accent' }
  else                    { verdict = '🔁 Keep trying';  verdictColor = 'text-ink/60' }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Result card */}
      <div className="w-full max-w-md bg-white border border-ink/10 rounded-2xl p-5 flex flex-col gap-4">
        <div className="text-center">
          <div className={`text-2xl font-bold ${verdictColor}`}>{verdict}</div>
          <div className="text-sm text-ink/50 mt-0.5">Score: {efficiency}% efficiency</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <div className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Your route</div>
            <div className="text-2xl font-bold text-red-600">{userCost}</div>
            <div className="text-xs text-red-400 mt-0.5">
              {userRoute.slice(0, -1).map(i => NODE_LABELS[i]).join(' → ')} → {NODE_LABELS[userRoute[0]]}
            </div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Optimal</div>
            <div className="text-2xl font-bold text-green-600">{optimal.cost}</div>
            <div className="text-xs text-green-600 mt-0.5">
              {optimal.route.slice(0, -1).map(i => NODE_LABELS[i]).join(' → ')} → {NODE_LABELS[optimal.route[0]]}
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex flex-col gap-1">
          <div className="w-full bg-ink/10 rounded-full h-3">
            <div className="h-full bg-gradient-to-r from-red-400 to-green-500 rounded-full transition-all"
              style={{ width: `${efficiency}%` }} />
          </div>
          <div className="flex justify-between text-xs text-ink/40">
            <span>0%</span><span>100% = optimal</span>
          </div>
        </div>
      </div>

      {/* Graph with both routes */}
      <div className="w-full max-w-md">
        <div className="flex gap-4 text-xs justify-center mb-2">
          <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-1 bg-red-400 rounded" /> Your route</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-1 bg-green-500 rounded" /> Optimal</span>
        </div>
        <div className="border border-ink/10 rounded-2xl overflow-hidden bg-paper">
          <GraphSVG nodes={nodes} userRoute={userRoute} optRoute={optimal.route}
            phase="result" onNodeClick={() => {}} activeNode={null} />
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-md">
        <button onClick={onPlayAgain}
          className="flex-1 bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
          Play again
        </button>
        <button onClick={onSettings}
          className="flex-1 border border-ink/20 text-ink font-medium py-3 rounded-xl hover:border-accent hover:text-accent transition-colors">
          Change map
        </button>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────
export default function TSPGame() {
  const [phase, setPhase]         = useState('lobby')
  const [nodeCount, setNodeCount] = useState(5)
  const [nodes, setNodes]         = useState(() => generateNodes(5))
  const [optimal, setOptimal]     = useState(null)
  const [userRoute, setUserRoute] = useState([])   // indices, e.g. [0, 2, 1, 3, 0]
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats]         = useState(() => loadStats())

  // Reroll graph
  const reroll = useCallback((n = nodeCount) => {
    setNodes(generateNodes(n))
  }, [nodeCount])

  // When nodeCount changes, reroll
  const handleNodeCount = (n) => {
    setNodeCount(n)
    setNodes(generateNodes(n))
  }

  function startGame() {
    const opt = solveOptimal(nodes)
    setOptimal(opt)
    setUserRoute([])
    setPhase('playing')
  }

  function handleNodeClick(i) {
    if (phase !== 'playing') return
    const n = nodes.length

    // First click — start node
    if (userRoute.length === 0) {
      setUserRoute([i])
      return
    }

    const startNode = userRoute[0]
    const allVisited = userRoute.length === n // visited all n nodes

    // Closing the loop: click start node after visiting all
    if (allVisited && i === startNode) {
      const finalRoute = [...userRoute, startNode]
      setUserRoute(finalRoute)
      finishGame(finalRoute)
      return
    }

    // Can't revisit (except closing)
    if (userRoute.includes(i)) return

    setUserRoute(prev => [...prev, i])
  }

  function finishGame(finalRoute) {
    const userCost = routeCost(nodes, finalRoute)
    const opt = optimal
    const efficiency = Math.round((opt.cost / userCost) * 100)
    const isOptimal = userCost === opt.cost

    const newStats = loadStats()
    newStats.gamesPlayed++
    if (isOptimal) newStats.optimalCount++
    if (efficiency > newStats.bestEfficiency) newStats.bestEfficiency = efficiency
    newStats.totalEfficiency += efficiency
    saveStats(newStats)
    setStats(newStats)

    setPhase('result')
  }

  function handleUndo() {
    setUserRoute(prev => prev.slice(0, -1))
  }

  function handlePlayAgain() {
    setNodes(generateNodes(nodeCount))
    setUserRoute([])
    setPhase('lobby')
  }

  function handleSettings() {
    setUserRoute([])
    setPhase('lobby')
  }

  function resetStats() {
    const fresh = { gamesPlayed: 0, optimalCount: 0, bestEfficiency: 0, totalEfficiency: 0 }
    saveStats(fresh)
    setStats(fresh)
  }

  const currentCost = userRoute.length >= 2 ? routeCost(nodes, userRoute) : 0
  const n = nodes.length
  const allVisited = userRoute.length === n
  const canClose = allVisited && userRoute.length > 0

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <a href="#/" className="text-ink/50 hover:text-accent transition-colors text-sm font-medium shrink-0">← Back</a>
          <h1 className="font-display text-lg font-bold text-ink flex-1">🗺️ TSP Game</h1>
          <button onClick={() => setShowStats(true)}
            className="text-sm text-ink/50 hover:text-accent transition-colors font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-accent shrink-0">
            📊 Stats
          </button>
          {phase === 'playing' && (
            <button onClick={handleSettings}
              className="text-sm text-ink/50 hover:text-red-400 transition-colors font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-red-300 shrink-0">
              {userRoute.length === 0 ? 'New map' : 'Give up'}
            </button>
          )}
        </div>
      </header>

      {/* Config modal */}
      {phase === 'lobby' && (
        <ConfigModal
          nodeCount={nodeCount}
          setNodeCount={handleNodeCount}
          onGenerate={() => reroll(nodeCount)}
          onPlay={startGame}
          nodes={nodes}
          stats={stats}
        />
      )}

      {showStats && (
        <StatsModal stats={stats} onClose={() => setShowStats(false)} onReset={resetStats} />
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center gap-6">
        {phase === 'playing' && (
          <>
            {/* Instructions / status */}
            <div className="w-full max-w-md text-center">
              {userRoute.length === 0 && (
                <p className="text-ink/60 text-sm">Click any city to start your route</p>
              )}
              {userRoute.length > 0 && !allVisited && (
                <p className="text-ink/60 text-sm">
                  Visit <strong className="text-ink">{n - userRoute.length}</strong> more {n - userRoute.length === 1 ? 'city' : 'cities'}, then return to <strong className="text-accent">{NODE_LABELS[userRoute[0]]}</strong>
                </p>
              )}
              {canClose && (
                <p className="text-green-600 text-sm font-medium">
                  All cities visited! Click <strong>{NODE_LABELS[userRoute[0]]}</strong> to finish ✓
                </p>
              )}
            </div>

            {/* Live cost + undo */}
            <div className="flex items-center gap-4">
              {currentCost > 0 && (
                <div className="bg-white border border-ink/10 rounded-xl px-4 py-2 text-center">
                  <div className="text-xs text-ink/50">Current cost</div>
                  <div className="text-xl font-bold text-accent">{currentCost}</div>
                </div>
              )}
              {userRoute.length > 0 && (
                <button onClick={handleUndo}
                  className="border border-ink/20 text-ink/60 hover:text-ink hover:border-ink/40 font-medium px-4 py-2 rounded-xl text-sm transition-colors">
                  ↩ Undo
                </button>
              )}
            </div>

            {/* Graph */}
            <div className="w-full max-w-md border border-ink/10 rounded-2xl overflow-hidden bg-white shadow-sm">
              <GraphSVG
                nodes={nodes}
                userRoute={userRoute}
                optRoute={[]}
                phase="playing"
                onNodeClick={handleNodeClick}
                activeNode={userRoute.length > 0 ? userRoute[userRoute.length - 1] : null}
              />
            </div>

            {/* Route so far */}
            {userRoute.length > 0 && (
              <div className="text-sm text-ink/50 text-center">
                {userRoute.map(i => NODE_LABELS[i]).join(' → ')}{!allVisited ? ' → ?' : ' → ' + NODE_LABELS[userRoute[0]] + ' ✓'}
              </div>
            )}
          </>
        )}

        {phase === 'result' && optimal && (
          <ResultScreen
            nodes={nodes}
            userRoute={userRoute}
            optimal={optimal}
            onPlayAgain={handlePlayAgain}
            onSettings={handleSettings}
          />
        )}

        {phase === 'lobby' && (
          <div className="text-center text-ink/30 text-sm pt-40">
            Configure your map in the panel above
          </div>
        )}
      </main>
    </div>
  )
}
