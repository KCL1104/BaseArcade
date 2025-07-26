import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { GameCard } from '../../components/GameCard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

// Mock analytics service
vi.mock('../../services/analyticsService', () => ({
  analyticsService: {
    trackFeatureUsed: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('GameCard Component', () => {
  const mockGame = {
    id: 'test-game',
    name: 'Test Game',
    description: 'A test game description',
    emoji: '🎮',
    status: 'active' as const,
    stats: {
      activePlayers: 10,
      totalPlayers: 100,
      liveMetric: 'High'
    }
  };

  it('should render game card with basic information', () => {
    renderWithRouter(<GameCard game={mockGame} />);
    
    expect(screen.getByText('Test Game')).toBeInTheDocument();
    expect(screen.getByText('A test game description')).toBeInTheDocument();
  });

  it('should render with game emoji', () => {
    renderWithRouter(<GameCard game={mockGame} />);
    
    expect(screen.getByText('🎮')).toBeInTheDocument();
  });

  it('should render play button for active games', () => {
    renderWithRouter(<GameCard game={mockGame} />);
    
    expect(screen.getByText('Play Now')).toBeInTheDocument();
  });
});