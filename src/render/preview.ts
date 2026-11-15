import { AmbientLight, Box3, DirectionalLight, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import type { ModelConfig } from '../sim';
import { ISO_FORWARD } from './coords';
import { buildModel } from './model';

/**
 * Картинка составной модели для карточек: та же `buildModel`, тот же изометрический ракурс и свет, что в бою.
 * Один общий рендерер за кадром; результат кешируется. Без WebGL (тесты, старый браузер) — null, карточка рисует примитив.
 */

/** Сторона кадра в клетках: модель масштаба 1 занимает одну и ту же долю картинки у всех сущностей. */
export const PREVIEW_SPAN = 1.8;
const PIXELS = 256;

let renderer: WebGLRenderer | null | undefined;
const cache = new Map<string, string | null>();

function getRenderer(): WebGLRenderer | null {
  if (renderer !== undefined) return renderer;
  try {
    if (typeof document === 'undefined') return (renderer = null);
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(PIXELS, PIXELS, false);
    renderer.setClearColor(0x000000, 0);
  } catch {
    renderer = null;
  }
  return renderer;
}

/** Data-URL картинки модели (PNG с прозрачным фоном) или null, если WebGL недоступен. */
export function modelPreview(model: ModelConfig, color: string): string | null {
  const key = `${model.id}|${color}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const r = getRenderer();
  let url: string | null = null;
  if (r) {
    try {
      const scene = new Scene();
      scene.add(new AmbientLight(0xffffff, 1.1));
      const sun = new DirectionalLight(0xffffff, 1.0);
      sun.position.set(-6, 14, 4);
      scene.add(sun);
      const obj = buildModel(model, color);
      scene.add(obj);
      const c = new Box3().setFromObject(obj).getCenter(new Vector3());
      const half = PREVIEW_SPAN / 2;
      const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
      camera.position.set(c.x - ISO_FORWARD.x * 20, c.y - ISO_FORWARD.y * 20, c.z - ISO_FORWARD.z * 20);
      camera.lookAt(c);
      r.render(scene, camera);
      url = r.domElement.toDataURL('image/png');
    } catch {
      url = null;
    }
  }
  cache.set(key, url);
  return url;
}
