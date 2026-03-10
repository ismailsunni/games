import { useRoute } from './hooks/useRoute'
import GameList from './pages/GameList'
import TicTacToe from './pages/TicTacToe'
import TicTacToe3D from './pages/TicTacToe3D'
import GinRummy from './pages/GinRummy'

export default function App() {
  const { route } = useRoute()

  if (route === '/tictactoe') return <TicTacToe />
  if (route === '/tictactoe3d') return <TicTacToe3D />
  if (route === '/ginrummy') return <GinRummy />
  return <GameList />
}
