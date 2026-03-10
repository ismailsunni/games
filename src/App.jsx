import { useRoute } from './hooks/useRoute'
import GameList from './pages/GameList'
import TicTacToe from './pages/TicTacToe'

export default function App() {
  const { route } = useRoute()

  if (route === '/tictactoe') return <TicTacToe />
  return <GameList />
}
