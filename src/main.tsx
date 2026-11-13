import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const root = createRoot(document.getElementById('root')!);

async function mount() {
  // Dev-галерея: только в dev-сборке (в prod ветка вырезается), отдельно от игры.
  if (import.meta.env.DEV && location.pathname.replace(/\/+$/, '') === '/gallery') {
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
