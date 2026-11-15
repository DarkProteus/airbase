import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/theme.css';
import { App } from './ui/App';
import { isGalleryPath } from './ui/route';

const root = createRoot(document.getElementById('root')!);

async function mount() {
  // Галерея — отдельный чанк, грузится только на своём пути (с учётом base).
  if (isGalleryPath(location.pathname, import.meta.env.BASE_URL)) {
    const { GalleryPage } = await import('./ui/gallery/GalleryPage');
    root.render(
      <StrictMode>
        <GalleryPage />
      </StrictMode>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void mount();
