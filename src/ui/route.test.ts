import { describe, expect, it } from 'vitest';
import { isGalleryPath } from './route';

describe('isGalleryPath', () => {
  it('dev: база /', () => {
    expect(isGalleryPath('/gallery', '/')).toBe(true);
    expect(isGalleryPath('/gallery/', '/')).toBe(true);
    expect(isGalleryPath('/gallery/index.html', '/')).toBe(true);
    expect(isGalleryPath('/', '/')).toBe(false);
    expect(isGalleryPath('/index.html', '/')).toBe(false);
  });

  it('Pages: база /airbase/', () => {
    expect(isGalleryPath('/airbase/gallery', '/airbase/')).toBe(true);
    expect(isGalleryPath('/airbase/gallery/', '/airbase/')).toBe(true);
    expect(isGalleryPath('/airbase/gallery/index.html', '/airbase/')).toBe(true);
    expect(isGalleryPath('/airbase/', '/airbase/')).toBe(false);
    expect(isGalleryPath('/airbase', '/airbase/')).toBe(false);
  });

  it('база без хвостового слеша и чужие пути', () => {
    expect(isGalleryPath('/airbase/gallery/', '/airbase')).toBe(true);
    expect(isGalleryPath('/gallery', '/airbase/')).toBe(false);
    expect(isGalleryPath('/airbase/gallery/x', '/airbase/')).toBe(false);
    expect(isGalleryPath('/airbase/gallery2', '/airbase/')).toBe(false);
  });
});
