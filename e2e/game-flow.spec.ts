import { test, expect } from '@playwright/test';

test.describe('Game Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    // Wait for the main UI elements to be visible
    await page.waitForSelector('text=Base Arcade', { timeout: 10000 });
  });

  test('should load the main page correctly', async ({ page }) => {
    // Check if the main elements are present
    await expect(page.locator('text=Base Arcade')).toBeVisible();
    await expect(page.locator('text=Your Onchain Arcade. Press Start to Play.')).toBeVisible();
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible();
  });

  test('should show wallet connection prompt when not connected', async ({ page }) => {
    // Check for wallet connection UI
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible();
    await expect(page.locator('text=Your Onchain Arcade. Press Start to Play.')).toBeVisible();
  });

  test('should handle wallet connection flow', async ({ page }) => {
    // Click connect wallet button
    await page.click('button:has-text("Connect Wallet")');

    // Wait for wallet selection modal to appear
    await expect(page.locator('text=Connect Wallet')).toBeVisible();

    // Check that wallet options are available
    await expect(page.locator('button:has-text("MetaMask")')).toBeVisible();
    await expect(page.locator('button:has-text("Rainbow")')).toBeVisible();
    await expect(page.locator('button:has-text("Coinbase Wallet")')).toBeVisible();
    await expect(page.locator('button:has-text("WalletConnect")')).toBeVisible();

    // Close the modal
    await page.click('button:has-text("Close")');

    // Verify modal is closed
    await expect(page.locator('text=連接錢包')).not.toBeVisible();
  });

  test('should display color palette correctly', async ({ page }) => {
    // Check color palette elements
    await expect(page.locator('[data-testid="color-palette"]')).toBeVisible();
    
    // Check for default colors
    const colorButtons = page.locator('[data-testid^="color-#"]');
    await expect(colorButtons).toHaveCount(24); // Default color count
    
    // Check for custom color picker
    await expect(page.locator('input[type="color"]')).toBeVisible();
  });

  test('should allow color selection', async ({ page }) => {
    // Click on a color
    await page.click('[data-testid="color-#00FF00"]');
    
    // Check if color is selected (has selected class)
    await expect(page.locator('[data-testid="color-#00FF00"]')).toHaveClass(/selected/);
    
    // Check if selected color info is updated
    await expect(page.locator('text=Selected: #00FF00')).toBeVisible();
  });

  test('should handle custom color addition', async ({ page }) => {
    // Use color picker to add custom color
    await page.fill('input[type="color"]', '#ABCDEF');
    
    // Check if custom color is added
    await expect(page.locator('[data-testid="custom-color-#ABCDEF"]')).toBeVisible();
  });

  test('should display game canvas', async ({ page }) => {
    // Check if canvas container is visible
    await expect(page.locator('[data-testid="game-canvas-container"]')).toBeVisible();
    
    // Check for canvas element
    await expect(page.locator('canvas')).toBeVisible();
    
    // Check for zoom controls
    await expect(page.locator('[aria-label="Zoom in"]')).toBeVisible();
    await expect(page.locator('[aria-label="Zoom out"]')).toBeVisible();
  });

  test('should show pixel placement UI when wallet connected', async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      (window as Window & { ethereum?: unknown }).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    // Connect wallet
    await page.click('text=Connect Wallet');
    await page.waitForTimeout(1000);
    
    // Check for pixel placement UI
    await expect(page.locator('text=Heat Level:')).toBeVisible();
    await expect(page.locator('text=Click on the canvas to place a pixel')).toBeVisible();
  });

  test('should handle zoom controls', async ({ page }) => {
    const zoomInButton = page.locator('[aria-label="Zoom in"]');
    const zoomOutButton = page.locator('[aria-label="Zoom out"]');
    
    // Test zoom in
    await zoomInButton.click();
    await page.waitForTimeout(500);
    
    // Test zoom out
    await zoomOutButton.click();
    await page.waitForTimeout(500);
    
    // Buttons should remain enabled
    await expect(zoomInButton).toBeEnabled();
    await expect(zoomOutButton).toBeEnabled();
  });

  test('should display pixel coordinates on hover', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    // Hover over canvas
    await canvas.hover({ position: { x: 100, y: 100 } });
    
    // Check for coordinate display
    await expect(page.locator('text=/X: \\d+, Y: \\d+/')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="game-canvas-container"]')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="game-canvas-container"]')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="game-canvas-container"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    // Try to interact with the app
    await page.reload();
    
    // Should show error message or fallback UI
    await expect(page.locator('text=/error|failed|unavailable/i')).toBeVisible();
  });

  test('should persist user preferences', async ({ page }) => {
    // Select a color
    await page.click('[data-testid="color-#FF00FF"]');
    
    // Add custom color
    await page.fill('input[type="color"]', '#123456');
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check if preferences are persisted
    await expect(page.locator('[data-testid="color-#FF00FF"]')).toHaveClass(/selected/);
    await expect(page.locator('[data-testid="custom-color-#123456"]')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Focus on first color button
    await page.keyboard.press('Tab');
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    
    // Select with Enter
    await page.keyboard.press('Enter');
    
    // Check if color is selected
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveClass(/selected/);
  });

  test('should display loading states', async ({ page }) => {
    // Check for initial loading state
    await expect(page.locator('text=Loading canvas')).toBeVisible();
    
    // Wait for loading to complete
    await page.waitForSelector('text=Loading canvas', { state: 'hidden' });
    
    // Canvas should be ready
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('should handle error states', async ({ page }) => {
    // Mock API error
    await page.route('**/api/pixels', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Try to load pixels
    await page.reload();
    
    // Should show error message
    await expect(page.locator('text=/error|failed/i')).toBeVisible();
  });

  test('should validate accessibility', async ({ page }) => {
    // Check for proper ARIA labels
    await expect(page.locator('[aria-label="Zoom in"]')).toBeVisible();
    await expect(page.locator('[aria-label="Zoom out"]')).toBeVisible();
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for keyboard accessibility
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate to different state
    await page.click('[data-testid="color-#0000FF"]');
    
    // Use browser back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Use browser forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    
    // App should handle navigation gracefully
    await expect(page.locator('[data-testid="game-canvas-container"]')).toBeVisible();
  });
});