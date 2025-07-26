import React, { useState, useEffect } from 'react'
import { Trophy, Clock, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatEther } from 'viem'
import fountainBackendService, { type FountainWinner } from '../../services/fountainBackendService'

interface FountainWinnersProps {
  className?: string
}

const FountainWinners: React.FC<FountainWinnersProps> = ({ className = '' }) => {
  const [winners, setWinners] = useState<FountainWinner[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const itemsPerPage = 10

  const loadWinners = async (page: number = 0) => {
    try {
      setLoading(true)
      const offset = page * itemsPerPage
      const data = await fountainBackendService.getRecentWinners(itemsPerPage, offset)
      
      if (page === 0) {
        setWinners(data)
      } else {
        setWinners(prev => [...prev, ...data])
      }
      
      setHasMore(data.length === itemsPerPage)
    } catch (error) {
      console.error('Error loading winners:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWinners(0)
  }, [])

  const handleNextPage = () => {
    if (hasMore && !loading) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadWinners(nextPage)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1
      setCurrentPage(prevPage)
      // For simplicity, reload from beginning up to current page
      loadWinners(0)
    }
  }

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return timestamp
    }
  }

  const openTransaction = (hash: string) => {
    const baseUrl = 'https://sepolia.basescan.org/tx/'
    window.open(`${baseUrl}${hash}`, '_blank')
  }

  if (loading && winners.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading winners...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="h-6 w-6 text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">Recent Winners</h2>
      </div>

      {/* Winners List */}
      {winners.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No winners yet</p>
          <p className="text-gray-500 text-sm">Be the first to win in The Fountain!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {winners.map((winner, index) => (
              <div
                key={`${winner.round_id}-${winner.winner_address}`}
                className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      {index === 0 && currentPage === 0 ? (
                        <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                          <Trophy className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {currentPage * itemsPerPage + index + 1}
                        </div>
                      )}
                    </div>

                    {/* Winner Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">
                          {formatAddress(winner.winner_address)}
                        </span>
                        <span className="text-blue-300 text-sm">
                          Round #{winner.round_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-300">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(winner.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Prize and Actions */}
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-400 mb-1">
                      {formatEther(BigInt(winner.prize_amount))} ETH
                    </div>
                    <button
                      onClick={() => openTransaction(winner.transaction_hash)}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 ml-auto transition-colors duration-200"
                    >
                      <span>View TX</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 text-white rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-2 text-white">
              <span className="text-sm">
                Page {currentPage + 1}
              </span>
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
            </div>

            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 text-white rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default FountainWinners