import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowLeft, Gamepad2 } from 'lucide-react'

interface PlatformShellProps {
  children: ReactNode
}

export function PlatformShell({ children }: PlatformShellProps) {
  const location = useLocation()
  const isGamePage = location.pathname.startsWith('/game')

  return (
    <div className="relative z-10 min-h-screen">
      {/* Header */}
      <header className="border-b border-accent-purple/30 bg-primary/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Navigation */}
            <div className="flex items-center space-x-6">
              <Link 
                to="/" 
                className="flex items-center space-x-3 text-2xl font-heading font-bold text-gradient hover:scale-105 transition-transform"
              >
                <Gamepad2 className="w-8 h-8 text-accent-fuchsia" />
                <span>Base Arcade</span>
              </Link>
              
              {isGamePage && (
                <Link 
                  to="/" 
                  className="flex items-center space-x-2 text-accent-cyan hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="font-heading">Back to Lobby</span>
                </Link>
              )}
            </div>

            {/* Tagline */}
            <div className="hidden md:block text-center">
              <p className="text-lg font-heading text-accent-cyan">
                Your Onchain Arcade. Press Start to Play.
              </p>
            </div>

            {/* Wallet Connection */}
            <div className="flex items-center space-x-4">
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  mounted,
                }) => {
                  const ready = mounted
                  const connected = ready && account && chain

                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        style: {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <button 
                              onClick={openConnectModal} 
                              className="btn-primary"
                            >
                              Connect Wallet
                            </button>
                          )
                        }

                        if (chain.unsupported) {
                          return (
                            <button 
                              onClick={openChainModal} 
                              className="btn-secondary border-accent-red text-accent-red hover:bg-accent-red"
                            >
                              Wrong Network
                            </button>
                          )
                        }

                        return (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={openChainModal}
                              className="btn-secondary text-sm"
                            >
                              {chain.hasIcon && (
                                <div className="w-4 h-4 mr-2">
                                  {chain.iconUrl && (
                                    <img
                                      alt={chain.name ?? 'Chain icon'}
                                      src={chain.iconUrl}
                                      className="w-4 h-4"
                                    />
                                  )}
                                </div>
                              )}
                              {chain.name}
                            </button>

                            <button 
                              onClick={openAccountModal} 
                              className="btn-primary"
                            >
                              {account.displayName}
                              {account.displayBalance
                                ? ` (${account.displayBalance})`
                                : ''}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  )
}