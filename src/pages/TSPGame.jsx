import { useState, useCallback } from 'react'

// ── Geometry ─────────────────────────────────────────────────
function dist(a, b) {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y))
}

function routeCost(nodes, route) {
  let cost = 0
  for (let i = 0; i < route.length - 1; i++) cost += dist(nodes[route[i]], nodes[route[i + 1]])
  return cost
}

// ── Node placement ───────────────────────────────────────────
const SVG_W = 420, SVG_H = 400
const PAD = 38

function minSep(n) {
  // Tighter packing for more nodes
  if (n <= 5)  return 80
  if (n <= 7)  return 65
  return 52
}

function generateNodes(n) {
  const sep = minSep(n)
  const nodes = []
  let attempts = 0
  while (nodes.length < n && attempts < 5000) {
    attempts++
    const x = PAD + Math.random() * (SVG_W - PAD * 2)
    const y = PAD + Math.random() * (SVG_H - PAD * 2)
    if (nodes.every(p => Math.hypot(p.x - x, p.y - y) >= sep)) {
      nodes.push({ x: Math.round(x), y: Math.round(y) })
    }
  }
  return nodes
}

// ── TSP Solver ───────────────────────────────────────────────
// Held-Karp DP — O(n² · 2ⁿ) — handles up to n=10 fine (~10ms)
function solveOptimal(nodes) {
  const n = nodes.length
  const d = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => dist(nodes[i], nodes[j]))
  )

  // dp[mask][i] = min cost to visit nodes in `mask`, ending at node i, starting from 0
  const INF = 1e9
  const size = 1 << n
  const dp   = Array.from({ length: size }, () => new Array(n).fill(INF))
  const prev = Array.from({ length: size }, () => new Array(n).fill(-1))

  dp[1][0] = 0  // start at node 0

  for (let mask = 1; mask < size; mask++) {
    for (let u = 0; u < n; u++) {
      if (!(mask & (1 << u))) continue
      if (dp[mask][u] === INF) continue
      for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue
        const newMask = mask | (1 << v)
        const newCost = dp[mask][u] + d[u][v]
        if (newCost < dp[newMask][v]) {
          dp[newMask][v] = newCost
          prev[newMask][v] = u
        }
      }
    }
  }

  const full = size - 1
  let best = INF, last = -1
  for (let u = 1; u < n; u++) {
    const cost = dp[full][u] + d[u][0]
    if (cost < best) { best = cost; last = u }
  }

  // Reconstruct path
  const route = []
  let mask = full, cur = last
  while (cur !== -1) {
    route.push(cur)
    const p = prev[mask][cur]
    mask ^= (1 << cur)
    cur = p
  }
  route.reverse()
  route.push(0) // return to start

  return { route, cost: best }
}

// ── Storage ──────────────────────────────────────────────────
const S_STATS = 'tsp_stats'
const S_STATE = 'tsp_state'

function loadStats() {
  try {
    const s = localStorage.getItem(S_STATS)
    return s ? JSON.parse(s) : { gamesPlayed: 0, optimalCount: 0, bestEfficiency: 0, totalEfficiency: 0 }
  } catch { return { gamesPlayed: 0, optimalCount: 0, bestEfficiency: 0, totalEfficiency: 0 } }
}
function saveStats(s) { localStorage.setItem(S_STATS, JSON.stringify(s)) }
function loadState() {
  try { const s = localStorage.getItem(S_STATE); return s ? JSON.parse(s) : null } catch { return null }
}
function saveState(s) { localStorage.setItem(S_STATE, JSON.stringify(s)) }
function clearState() { localStorage.removeItem(S_STATE) }

// ── Constants ────────────────────────────────────────────────
const NODE_R     = 16
const NODE_LABELS = 'ABCDEFGHIJ'
const DIFFICULTIES = { 3:'Easy', 4:'Easy+', 5:'Medium', 6:'Medium+', 7:'Hard', 8:'Hard+', 9:'Expert', 10:'Expert+' }

// ── Graph SVG ────────────────────────────────────────────────
function GraphSVG({ nodes, userRoute, optRoute, phase, onNodeClick, activeNode }) {
  const n        = nodes.length
  const isResult = phase === 'result'
  const isPlay   = phase === 'playing'

  // Edge weights — hide labels if too many edges (cluttered)
  const showLabels = n <= 6
  const edges = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      edges.push([i, j, dist(nodes[i], nodes[j])])

  function segs(route) {
    const s = []
    for (let i = 0; i < route.length - 1; i++) s.push([route[i], route[i + 1]])
    return s
  }

  const userSegs = segs(userRoute)
  const optSegs  = isResult ? segs(optRoute) : []

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
      {/* All edges */}
      {edges.map(([i, j, w]) => {
        const a = nodes[i], b = nodes[j]
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        return (
          <g key={`e-${i}-${j}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e5e7eb" strokeWidth="1.5" />
            {showLabels && (
              <>
                <rect x={mx - 12} y={my - 8} width={24} height={16} rx={3} fill="white" fillOpacity="0.9" />
                <text x={mx} y={my + 4.5} textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="500">{w}</text>
              </>
            )}
          </g>
        )
      })}

      {/* Optimal route — green */}
      {optSegs.map(([i, j], k) => (
        <line key={`opt-${k}`}
          x1={nodes[i].x} y1={nodes[i].y} x2={nodes[j].x} y2={nodes[j].y}
          stroke="#22c55e" strokeWidth="4.5" strokeLinecap="round" opacity="0.75" />
      ))}

      {/* User route — red */}
      {userSegs.map(([i, j], k) => (
        <line key={`usr-${k}`}
          x1={nodes[i].x} y1={nodes[i].y} x2={nodes[j].x} y2={nodes[j].y}
          stroke="#e63946" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
      ))}

      {/* Nodes */}
      {nodes.map((p, i) => {
        const visited   = userRoute.includes(i)
        const isCurrent = activeNode === i
        const isStart   = userRoute[0] === i
        const allDone   = userRoute.length === n
        const canClose  = allDone && isStart && isPlay

        let fill = '#f9fafb', stroke = '#d1d5db', textFill = '#6b7280'
        if (canClose)       { fill = '#dcfce7'; stroke = '#22c55e'; textFill = '#15803d' }
        else if (isCurrent) { fill = '#e63946'; stroke = '#c81d28'; textFill = '#fff' }
        else if (visited)   { fill = '#fee2e2'; stroke = '#fca5a5'; textFill = '#e63946' }

        return (
          <g key={i} onClick={() => isPlay && onNodeClick(i)}
            style={{ cursor: isPlay ? 'pointer' : 'default' }}>
            {/* Pulse ring for clickable unvisited */}
            {isPlay && !visited && !isCurrent && (
              <circle cx={p.x} cy={p.y} r={NODE_R + 4} fill="none"
                stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
            )}
            <circle cx={p.x} cy={p.y} r={NODE_R} fill={fill} stroke={stroke} strokeWidth="2.5" />
            <text x={p.x} y={p.y + 5} textAnchor="middle"
              fontSize="12" fontWeight="800" fill={textFill} style={{ pointerEvents: 'none' }}>
              {NODE_LABELS[i]}
            </text>
            {/* Visit order */}
            {visited && userRoute.indexOf(i) > 0 && (
              <text x={p.x + NODE_R - 1} y={p.y - NODE_R + 5}
                textAnchor="middle" fontSize="8" fontWeight="700" fill="#e63946">
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
function ConfigModal({ config, onChange, nodes, onReroll, onPlay, hasSaved, onContinue }) {
  const { nodeCount } = config

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
          <div className="flex justify-between">
            <span className="text-xs font-semibold text-ink/50 uppercase tracking-wider">Cities</span>
            <span className="text-xs font-bold text-accent">{DIFFICULTIES[nodeCount]}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[3,4,5,6,7,8,9,10].map(n => (
              <button key={n}
                onClick={() => { onChange({ ...config, nodeCount: n }); onReroll(n) }}
                className={['flex-1 min-w-[2.5rem] py-2 text-sm font-medium rounded-lg border transition-colors',
                  nodeCount === n ? 'bg-ink text-paper border-ink' : 'bg-white text-ink/60 border-ink/20 hover:border-ink/40'].join(' ')}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Graph preview */}
        <div className="border border-ink/10 rounded-xl overflow-hidden bg-paper">
          <GraphSVG nodes={nodes} userRoute={[]} optRoute={[]}
            phase="preview" onNodeClick={() => {}} activeNode={null} />
        </div>

        <button onClick={() => onReroll(nodeCount)}
          className="text-sm border border-ink/20 text-ink/60 hover:text-accent hover:border-accent py-2 rounded-lg transition-colors">
          🔄 Re-roll map
        </button>

        <div className="flex flex-col gap-2">
          <button onClick={onPlay}
            className="w-full bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
            Play →
          </button>
          {hasSaved && (
            <button onClick={onContinue}
              className="w-full border border-ink/20 text-ink font-medium py-2.5 rounded-xl text-sm hover:border-accent hover:text-accent transition-colors">
              Continue saved game
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stats modal ──────────────────────────────────────────────
function StatsModal({ stats, onClose, onReset }) {
  const avg = stats.gamesPlayed > 0 ? Math.round(stats.totalEfficiency / stats.gamesPlayed) : 0
  const optRate = stats.gamesPlayed > 0 ? Math.round((stats.optimalCount / stats.gamesPlayed) * 100) : 0

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
            <div key={label} className="bg-paper rounded-xl p-3">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-ink/50 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-ink/60">Optimal rate</span>
            <span className="font-bold">{optRate}%</span>
          </div>
          <div className="w-full bg-ink/10 rounded-full h-2">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${optRate}%` }} />
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
  const userCost   = routeCost(nodes, userRoute)
  const efficiency = Math.round((optimal.cost / userCost) * 100)
  const isOptimal  = userCost === optimal.cost

  let verdict, verdictColor
  if (isOptimal)             { verdict = '🏆 Optimal!';     verdictColor = 'text-green-600' }
  else if (efficiency >= 95) { verdict = '⭐ Near perfect';  verdictColor = 'text-blue-600' }
  else if (efficiency >= 80) { verdict = '👍 Good route';   verdictColor = 'text-accent' }
  else                       { verdict = '🔁 Keep trying';  verdictColor = 'text-ink/60' }

  const fmtRoute = (r) => r.slice(0, -1).map(i => NODE_LABELS[i]).join('→') + '→' + NODE_LABELS[r[0]]

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="w-full max-w-md bg-white border border-ink/10 rounded-2xl p-5 flex flex-col gap-4">
        <div className="text-center">
          <div className={`text-2xl font-bold ${verdictColor}`}>{verdict}</div>
          <div className="text-sm text-ink/50 mt-0.5">Score: {efficiency}% efficiency</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <div className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Your route</div>
            <div className="text-2xl font-bold text-red-600">{userCost}</div>
            <div className="text-[10px] text-red-400 mt-1 break-all leading-relaxed">{fmtRoute(userRoute)}</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Optimal</div>
            <div className="text-2xl font-bold text-green-600">{optimal.cost}</div>
            <div className="text-[10px] text-green-600 mt-1 break-all leading-relaxed">{fmtRoute(optimal.route)}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="w-full bg-ink/10 rounded-full h-3">
            <div className="h-full bg-gradient-to-r from-red-400 to-green-500 rounded-full"
              style={{ width: `${efficiency}%` }} />
          </div>
          <div className="flex justify-between text-xs text-ink/40">
            <span>0%</span><span>100% = optimal</span>
          </div>
        </div>
      </div>

      {/* Both routes on graph */}
      <div className="w-full max-w-md">
        <div className="flex gap-4 text-xs justify-center mb-2 text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-1 bg-red-400 rounded" /> Your route
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-1 bg-green-500 rounded" /> Optimal
          </span>
        </div>
        <div className="border border-ink/10 rounded-2xl overflow-hidden bg-white shadow-sm">
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

// ── Main ─────────────────────────────────────────────────────
const DEFAULT_CONFIG = { nodeCount: 5 }

export default function TSPGame() {
  const [phase, setPhase]     = useState('lobby')
  const [config, setConfig]   = useState(DEFAULT_CONFIG)
  const [nodes, setNodes]     = useState(() => generateNodes(DEFAULT_CONFIG.nodeCount))
  const [optimal, setOptimal] = useState(null)
  const [userRoute, setUserRoute] = useState([])
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats]     = useState(() => loadStats())
  const [savedGame, setSavedGame] = useState(() => loadState())

  const reroll = useCallback((n) => {
    setNodes(generateNodes(n ?? config.nodeCount))
  }, [config.nodeCount])

  function startFresh() {
    const opt = solveOptimal(nodes)
    setOptimal(opt)
    setUserRoute([])
    clearState()
    setSavedGame(null)
    setPhase('playing')
  }

  function continueSaved() {
    if (!savedGame) return
    setConfig(savedGame.config)
    setNodes(savedGame.nodes)
    setOptimal(savedGame.optimal)
    setUserRoute(savedGame.userRoute)
    setPhase('playing')
  }

  function handleNodeClick(i) {
    if (phase !== 'playing') return
    const n = nodes.length

    if (userRoute.length === 0) { setUserRoute([i]); return }

    const startNode  = userRoute[0]
    const allVisited = userRoute.length === n

    if (allVisited && i === startNode) {
      const final = [...userRoute, startNode]
      setUserRoute(final)
      finishGame(final)
      return
    }

    if (userRoute.includes(i)) return
    const next = [...userRoute, i]
    setUserRoute(next)

    // Autosave mid-game
    saveState({ config, nodes, optimal, userRoute: next })
  }

  function finishGame(finalRoute) {
    clearState(); setSavedGame(null)
    const userCost   = routeCost(nodes, finalRoute)
    const efficiency = Math.round((optimal.cost / userCost) * 100)
    const isOptimal  = userCost === optimal.cost

    const ns = loadStats()
    ns.gamesPlayed++
    if (isOptimal) ns.optimalCount++
    if (efficiency > ns.bestEfficiency) ns.bestEfficiency = efficiency
    ns.totalEfficiency += efficiency
    saveStats(ns)
    setStats(ns)
    setPhase('result')
  }

  function handleUndo() {
    setUserRoute(prev => {
      const next = prev.slice(0, -1)
      if (next.length > 0) saveState({ config, nodes, optimal, userRoute: next })
      else clearState()
      return next
    })
  }

  function handleGiveUp() {
    clearState(); setSavedGame(null)
    setPhase('lobby')
  }

  function handlePlayAgain() {
    setNodes(generateNodes(config.nodeCount))
    setUserRoute([])
    setPhase('lobby')
  }

  function resetStats() {
    const fresh = { gamesPlayed: 0, optimalCount: 0, bestEfficiency: 0, totalEfficiency: 0 }
    saveStats(fresh); setStats(fresh)
  }

  const n          = nodes.length
  const allVisited = userRoute.length === n
  const canClose   = allVisited && userRoute.length > 0
  const currentCost = userRoute.length >= 2 ? routeCost(nodes, userRoute) : 0
  const hasMoved   = userRoute.length > 0

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-ink/10 bg-canvas px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <a href="#/" className="text-ink/50 hover:text-accent text-sm font-medium shrink-0">← Back</a>
          <h1 className="font-display text-lg font-bold text-ink flex-1">🗺️ TSP Game</h1>
          <button onClick={() => setShowStats(true)}
            className="text-sm text-ink/50 hover:text-accent font-medium border border-ink/20 px-3 py-1.5 rounded-lg hover:border-accent shrink-0">
            📊 Stats
          </button>
          {phase === 'playing' && (
            <button onClick={handleGiveUp}
              className={['text-sm font-medium border px-3 py-1.5 rounded-lg transition-colors shrink-0',
                hasMoved
                  ? 'text-ink/50 hover:text-red-400 border-ink/20 hover:border-red-300'
                  : 'text-ink/50 hover:text-accent border-ink/20 hover:border-accent'].join(' ')}>
              {hasMoved ? 'Give up' : 'New map'}
            </button>
          )}
        </div>
      </header>

      {/* Config modal */}
      {phase === 'lobby' && (
        <ConfigModal
          config={config}
          onChange={setConfig}
          nodes={nodes}
          onReroll={reroll}
          onPlay={startFresh}
          hasSaved={!!savedGame}
          onContinue={continueSaved}
        />
      )}

      {showStats && (
        <StatsModal stats={stats} onClose={() => setShowStats(false)} onReset={resetStats} />
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center gap-5">

        {phase === 'playing' && (
          <>
            {/* Status bar */}
            <div className="w-full max-w-md flex items-center justify-between gap-4">
              <div className="text-sm text-ink/60">
                {userRoute.length === 0 && 'Click any city to start'}
                {userRoute.length > 0 && !allVisited && (
                  <span><strong className="text-ink">{n - userRoute.length}</strong> more {n - userRoute.length === 1 ? 'city' : 'cities'} — return to <strong className="text-accent">{NODE_LABELS[userRoute[0]]}</strong></span>
                )}
                {canClose && (
                  <span className="text-green-600 font-medium">Click <strong>{NODE_LABELS[userRoute[0]]}</strong> to finish ✓</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {currentCost > 0 && (
                  <div className="bg-white border border-ink/10 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-xs text-ink/40 leading-none">Cost</div>
                    <div className="text-base font-bold text-accent leading-tight">{currentCost}</div>
                  </div>
                )}
                {userRoute.length > 0 && (
                  <button onClick={handleUndo}
                    className="border border-ink/20 text-ink/60 hover:text-ink hover:border-ink/40 px-3 py-1.5 rounded-lg text-sm transition-colors">
                    ↩
                  </button>
                )}
              </div>
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

            {/* Route breadcrumb */}
            {userRoute.length > 0 && (
              <div className="text-xs text-ink/40 text-center tracking-wide">
                {userRoute.map(i => NODE_LABELS[i]).join(' → ')}
                {!allVisited ? ' → ?' : ` → ${NODE_LABELS[userRoute[0]]} ✓`}
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
            onSettings={() => { setUserRoute([]); setPhase('lobby') }}
          />
        )}
      </main>
    </div>
  )
}
