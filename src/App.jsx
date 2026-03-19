import { useRegisterSW } from 'virtual:pwa-register/react'
import { useRoute } from './hooks/useRoute'
import GameList from './pages/GameList'
import TicTacToe from './pages/TicTacToe'
import TicTacToe3D from './pages/TicTacToe3D'
import TicTacTwo from './pages/TicTacTwo'
import GinRummy from './pages/GinRummy'
import MapGuesser from './pages/MapGuesser'
import ColorGuesser from './pages/ColorGuesser'
import RGBGuesser from './pages/RGBGuesser'
import ColorNameQuiz from './pages/ColorNameQuiz'

function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
      <span>🆕 New version available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="bg-white text-ink px-3 py-1 rounded-lg font-semibold hover:bg-ink/10 hover:text-white transition-colors"
      >
        Reload
      </button>
    </div>
  )
}

export default function App() {
  const { route } = useRoute()

  return (
    <>
      <UpdateToast />
      {route === '/tictactoe' && <TicTacToe />}
      {route === '/tictactoe3d' && <TicTacToe3D />}
      {route === '/tictactwo' && <TicTacTwo />}
      {route === '/ginrummy' && <GinRummy />}
      {route === '/mapguesser' && <MapGuesser />}
      {route === '/colorguesser' && <ColorGuesser />}
      {route === '/colorguesser/rgb' && <RGBGuesser />}
      {route === '/colorguesser/namequiz' && <ColorNameQuiz />}
      {!route || route === '/' ? <GameList /> : null}
    </>
  )
}
