import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { clearDataCache } from './loadData';

afterEach(() => {
  cleanup();
  clearDataCache();
  window.history.replaceState(null, '', '/');
});

// Most tests were written around a fixed calendar (dive #1 on 3 November 2026). They run against that date, whatever the
// real LAUNCH_DATE is; launch.test.tsx and schedule.test.ts check the real constant with importActual.
vi.mock('./config', async (importOriginal) => ({ ...(await importOriginal<typeof import('./config')>()), LAUNCH_DATE: '2026-11-03' }));
