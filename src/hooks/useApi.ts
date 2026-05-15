// In dev Vite runs on :5173, backend on :3001.
// HTTP proxy works for most things but let's be explicit.
export function apiUrl(path: string) {
  const base = window.location.port === '5173'
    ? `http://${window.location.hostname}:3001`
    : ''
  return `${base}${path}`
}
