import React from 'react'
import FountainGame from '../components/games/FountainGame'
import FountainWinners from '../components/games/FountainWinners'

const Fountain: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Main Game Section */}
      <FountainGame />
      
      {/* Winners Section */}
      <div className="container mx-auto px-4 pb-8">
        <FountainWinners className="max-w-4xl mx-auto" />
      </div>
    </div>
  )
}

export default Fountain