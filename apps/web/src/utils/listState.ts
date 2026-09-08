export function preserveListState(path: string, location: { pathname: string; search: string }) {
  const normalizedSearch = location.search
    ? location.search.startsWith('?') ? location.search : `?${location.search}`
    : '';
  const returnTo = `${location.pathname}${normalizedSearch}`;
  return `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
}

export function getReturnTo(search: string, fallback: string) {
  const value = new URLSearchParams(search).get('returnTo');
  return value && value.startsWith('/') ? value : fallback;
}
