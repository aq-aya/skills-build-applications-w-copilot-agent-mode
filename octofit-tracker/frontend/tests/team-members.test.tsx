import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Teams from '../src/components/Teams.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows member names rather than database IDs', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    teams: [{ name: 'Octocats', members: ['507f1f77bcf86cd799439011'], memberDetails: [{ id: '507f1f77bcf86cd799439011', name: 'Mona' }] }],
  }), { status: 200 })));
  render(<Teams />);
  expect(await screen.findByText(/Mona/)).toBeInTheDocument();
  expect(screen.queryByText(/507f1f77bcf86cd799439011/)).not.toBeInTheDocument();
});
