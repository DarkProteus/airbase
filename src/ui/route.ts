/** Страница галереи: `<base>gallery`, `<base>gallery/` или `<base>gallery/index.html`. */
export function isGalleryPath(pathname: string, baseUrl: string): boolean {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (!pathname.startsWith(base) && pathname !== base.replace(/\/+$/, '')) return false;
  const rest = pathname.slice(base.length).replace(/\/+$/, '');
  return rest === 'gallery' || rest === 'gallery/index.html';
}
