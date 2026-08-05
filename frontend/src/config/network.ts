/**
 * Shared network configuration for API and WebSocket connections.
 *
 * These helpers are base-relative: they derive URLs from Vite's `base` config
 * (currently "/" for local development), so requests go to /api/... and
 * /socket.io/... on the same origin, which the Vite dev server proxies to the
 * backend on :8000. Set VITE_API_URL to point at an absolute backend URL if
 * ever needed.
 */

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const basePath = (): string =>
  trimTrailingSlash(import.meta.env.BASE_URL || '');

export const getApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured?.startsWith('http')) {
    return trimTrailingSlash(configured);
  }
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api';
  }
  // e.g. /api  — proxied to the backend by the Vite dev server
  return `${basePath()}/api`;
};

export const getBackendBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured?.startsWith('http')) {
    return trimTrailingSlash(configured).replace(/\/api\/?$/, '');
  }
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }
  // Socket.IO connects to the same origin; custom path set via getSocketPath().
  return window.location.origin;
};

// Socket.IO client path — must match the Vite dev-server proxy.
// e.g. /socket.io
export const getSocketPath = (): string => `${basePath()}/socket.io`;
