import { useRoute } from './hooks/useRoute'
import GameList from './pages/GameList'
import TicTacToe from './pages/TicTacToe'
import TicTacToe3D from './pages/TicTacToe3D'
import TicTacTwo from './pages/TicTacTwo'
import GinRummy from './pages/GinRummy'
import MapGuesser from './pages/MapGuesser'

export default function App() {
  const { route } = useRoute()

  if (route === '/tictactoe') return <TicTacToe />
  if (route === '/tictactoe3d') return <TicTacToe3D />
  if (route === '/tictactwo') return <TicTacTwo />
  if (route === '/ginrummy') return <GinRummy />
  if (route === '/mapguesser') return <MapGuesser />
  return <GameList />
}
