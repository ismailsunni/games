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
import ColorNameQuizInfinite from './pages/ColorNameQuizInfinite'
import ColorQuizMenu from './pages/ColorQuizMenu'
import TSPGame from './pages/TSPGame'
import TSPRealGame from './pages/TSPRealGame'
import ArithmeticRush from './pages/ArithmeticRush'

function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink text-white px-4 py-2.5 rounded-xl shadow-lg text-sm">
      <span>🆕 Update available</span>
      <button onClick={() => updateServiceWorker(true)} className="bg-accent text-white px-3 py-1 rounded-lg font-semibold hover:opacity-90 transition-opacity">Update</button>
    </div>
  )
}

export default function App() {
  const { route } = useRoute()

  let page
  if (route === '/tictactoe') page = <TicTacToe />
  else if (route === '/tictactoe3d') page = <TicTacToe3D />
  else if (route === '/tictactwo') page = <TicTacTwo />
  else if (route === '/ginrummy') page = <GinRummy />
  else if (route === '/mapguesser') page = <MapGuesser />
  else if (route === '/colorguesser') page = <ColorGuesser />
  else if (route === '/colorguesser/rgb') page = <RGBGuesser />
  else if (route === '/colorguesser/namequiz')          page = <ColorQuizMenu type="name" />
  else if (route === '/colorguesser/namequiz/play')     page = <ColorNameQuiz />
  else if (route === '/colorguesser/namequiz/infinite') page = <ColorNameQuizInfinite />
  else if (route === '/colorguesser/swatchquiz')        page = <ColorQuizMenu type="swatch" />
  else if (route === '/colorguesser/swatchquiz/play')   page = <ColorNameQuiz reverse />
  else if (route === '/colorguesser/swatchquiz/infinite') page = <ColorNameQuizInfinite reverse />
  else if (route === '/tspgame') page = <TSPGame />
  else if (route === '/tspreal') page = <TSPRealGame />
  else if (route === '/arithmetic') page = <ArithmeticRush />
  else page = <GameList />

  return (
    <>
      <UpdateToast />
      {page}
    </>
  )
}
