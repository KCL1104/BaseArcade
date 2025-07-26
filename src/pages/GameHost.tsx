import { useParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChromaGame } from '../components/games/ChromaGame'
import FountainGame from '../components/games/FountainGame'


export function GameHost() {
  const { gameId } = useParams<{ gameId: string }>()

  if (!gameId) {
    return <Navigate to="/" replace />
  }

  const renderGame = () => {
    switch (gameId) {
      case 'chroma':
        return <ChromaGame />
      case 'the-fountain':
        return <FountainGame />
      default:
        return (
          <div className="container mx-auto px-4 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl font-heading font-bold text-gradient mb-4">
                Game Not Found
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                The game "{gameId}" doesn't exist or is not available yet.
              </p>
              <button 
                onClick={() => window.history.back()}
                className="btn-primary"
              >
                Go Back
              </button>
            </motion.div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="h-full"
      >
        {renderGame()}
      </motion.div>
    </div>
  )
}