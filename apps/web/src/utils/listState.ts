export function preserveListState(path: string, location: { pathname: string; search: string }) {
  const returnTo = `${location.pathname}${location.search}`;
  return `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
}

export function getReturnTo(search: string, fallback: string) {
  const value = new URLSearchParams(search).get('returnTo');
  return value && value.startsWith('/') ? value : fallback;
}
