import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import { visualOf } from '../ui/entity/model';
import type { PreviewShape } from '../ui/entity/model';
import { buildPath, pointAt } from '../sim';
import type { Content, MissionConfig, SimState } from '../sim';
import { cellToWorld, fitView, ISO_FORWARD, pickCell, slotIndexAt } from './coords';
import type { IsoView } from './coords';

/**
 * Three.js-сцена карты. Строится целиком из MissionConfig (сетка, путь, слоты) и Content (облик сущностей),
 * дальше только читает снапшот симуляции: update(state). Камера зафиксирована — никаких controls.
 */

export interface SceneHandle {
  /** Нарисовать сущности снапшота. */
  update(state: SimState): void;
  dispose(): void;
}

export interface SceneOptions {
  /** Клик по слоту размещения (индекс в mission.slots). */
  onSlotClick?: (slot: number) => void;
}

const COLORS = {
  background: 0x10151c,
  ground: 0x2b3a2f,
  grid: 0x3c4f41,
  path: 0x8a7a55,
  slot: 0x4f78a8,
  slotHover: 0x8fc1f5,
  spawn: 0xb5533c,
  base: 0x3d9c6b,
};

const CAMERA_DISTANCE = 40;

/** CSS-цвет из visualOf ('hsl(h s% l%)') -> three.Color; Color.setStyle не понимает пробельный синтаксис. */
function cssColor(css: string): Color {
  const m = /^hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)$/.exec(css);
  return m ? new Color().setHSL(Number(m[1]) / 360, Number(m[2]) / 100, Number(m[3]) / 100) : new Color(css);
}

function shapeGeometry(shape: PreviewShape): BufferGeometry {
  switch (shape) {
    case 'cube':
      return new BoxGeometry(0.6, 0.6, 0.6).translate(0, 0.3, 0);
    case 'cylinder':
      return new CylinderGeometry(0.3, 0.3, 0.7, 16).translate(0, 0.35, 0);
    case 'pyramid':
      return new ConeGeometry(0.4, 0.8, 4).rotateY(Math.PI / 4).translate(0, 0.4, 0);
    case 'sphere':
      return new SphereGeometry(0.33, 20, 14).translate(0, 0.33, 0);
  }
}

function gridLines(w: number, h: number): LineSegments {
  const pos: number[] = [];
  const x0 = -w / 2;
  const z0 = -h / 2;
  for (let i = 0; i <= w; i++) pos.push(x0 + i, 0.01, z0, x0 + i, 0.01, z0 + h);
  for (let j = 0; j <= h; j++) pos.push(x0, 0.01, z0 + j, x0 + w, 0.01, z0 + j);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return new LineSegments(geo, new LineBasicMaterial({ color: COLORS.grid }));
}

export function createScene(
  container: HTMLElement,
  mission: MissionConfig,
  content: Content,
  options: SceneOptions = {},
): SceneHandle {
  const { size } = mission;
  const path = buildPath(mission.path);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(COLORS.background);
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.1));
  const sun = new DirectionalLight(0xffffff, 1.0);
  sun.position.set(-6, 14, 4);
  scene.add(sun);

  // Камера: фиксированная ортографическая изометрия, параметры окна считаются в coords.ts.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(-ISO_FORWARD.x * CAMERA_DISTANCE, -ISO_FORWARD.y * CAMERA_DISTANCE, -ISO_FORWARD.z * CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  let view: IsoView = fitView(size, 1, 1);

  // --- статика карты ---
  const map = new Group();
  scene.add(map);

  const ground = new Mesh(new BoxGeometry(size.w, 0.4, size.h), new MeshLambertMaterial({ color: COLORS.ground }));
  ground.position.y = -0.2;
  map.add(ground);
  map.add(gridLines(size.w, size.h));

  const pathMat = new MeshLambertMaterial({ color: COLORS.path });
  const PATH_W = 0.8;
  for (let i = 1; i < mission.path.length; i++) {
    const a = cellToWorld(mission.path[i - 1]!, size);
    const b = cellToWorld(mission.path[i]!, size);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const seg = new Mesh(new BoxGeometry(len + PATH_W, 0.04, PATH_W), pathMat);
    seg.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    map.add(seg);
  }

  const first = mission.path[0]!;
  const last = mission.path[mission.path.length - 1]!;
  const spawn = new Mesh(new BoxGeometry(0.9, 0.12, 0.9), new MeshLambertMaterial({ color: COLORS.spawn }));
  const sp = cellToWorld(first, size);
  spawn.position.set(sp.x, 0.06, sp.z);
  map.add(spawn);
  const baseMesh = new Mesh(new BoxGeometry(0.9, 0.7, 0.9), new MeshLambertMaterial({ color: COLORS.base }));
  const bp = cellToWorld(last, size);
  baseMesh.position.set(bp.x, 0.35, bp.z);
  map.add(baseMesh);

  const slotMat = new MeshLambertMaterial({ color: COLORS.slot });
  const slotMeshes: Mesh[] = mission.slots.map((s) => {
    const m = new Mesh(new BoxGeometry(0.9, 0.08, 0.9), slotMat);
    const p = cellToWorld(s, size);
    m.position.set(p.x, 0.04, p.z);
    map.add(m);
    return m;
  });
  const hoverMat = new MeshLambertMaterial({ color: COLORS.slotHover });

  // --- динамика: сущности снапшота ---
  const geoCache = new Map<PreviewShape, BufferGeometry>();
  const matCache = new Map<string, Material>();
  const bodyMesh = (entity: { role?: string; tags: readonly string[] }, scale: number) => {
    const v = visualOf(entity);
    let geo = geoCache.get(v.shape);
    if (!geo) geoCache.set(v.shape, (geo = shapeGeometry(v.shape)));
    let mat = matCache.get(v.color);
    if (!mat) matCache.set(v.color, (mat = new MeshLambertMaterial({ color: cssColor(v.color) })));
    const m = new Mesh(geo, mat);
    m.scale.setScalar(v.size * scale);
    return { mesh: m, lift: v.flying ? 0.9 : 0 };
  };

  const enemyMeshes = new Map<number, { obj: Object3D; lift: number }>();
  const unitMeshes = new Map<number, Object3D>();
  const dynamic = new Group();
  scene.add(dynamic);

  let hovered = -1;
  const setHover = (i: number) => {
    if (i === hovered) return;
    if (hovered >= 0) slotMeshes[hovered]!.material = slotMat;
    hovered = i;
    if (i >= 0) slotMeshes[i]!.material = hoverMat;
    draw();
  };

  const draw = () => renderer.render(scene, camera);

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h);
    view = fitView(size, w, h);
    camera.left = view.centerU - w / 2 / view.zoom;
    camera.right = view.centerU + w / 2 / view.zoom;
    camera.top = view.centerV + h / 2 / view.zoom;
    camera.bottom = view.centerV - h / 2 / view.zoom;
    camera.updateProjectionMatrix();
    draw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const slotAtEvent = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    const cell = pickCell({ x: e.clientX - r.left, y: e.clientY - r.top }, view, size);
    return cell ? slotIndexAt(mission.slots, cell) : -1;
  };
  const onMove = (e: PointerEvent) => setHover(slotAtEvent(e));
  const onLeave = () => setHover(-1);
  const onClick = (e: PointerEvent) => {
    const i = slotAtEvent(e);
    if (i >= 0) options.onSlotClick?.(i);
  };
  const el = renderer.domElement;
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerup', onClick);

  const update = (state: SimState) => {
    const seenEnemies = new Set<number>();
    for (const e of state.enemies) {
      seenEnemies.add(e.id);
      let entry = enemyMeshes.get(e.id);
      if (!entry) {
        const cfg = content.enemies[e.type];
        const { mesh, lift } = bodyMesh({ tags: cfg?.tags ?? [e.type] }, 0.8);
        dynamic.add(mesh);
        entry = { obj: mesh, lift };
        enemyMeshes.set(e.id, entry);
      }
      const p = cellToWorld(pointAt(path, e.dist), size, entry.lift);
      entry.obj.position.set(p.x, p.y, p.z);
    }
    for (const [id, entry] of enemyMeshes)
      if (!seenEnemies.has(id)) {
        dynamic.remove(entry.obj);
        enemyMeshes.delete(id);
      }

    const seenUnits = new Set<number>();
    for (const u of state.units) {
      seenUnits.add(u.id);
      if (unitMeshes.has(u.id)) continue;
      const cfg = content.units[u.type];
      const slot = mission.slots[u.slot];
      if (!cfg || !slot) continue;
      const { mesh, lift } = bodyMesh({ role: cfg.role, tags: cfg.tags }, 1);
      const p = cellToWorld(slot, size, 0.08 + lift);
      mesh.position.set(p.x, p.y, p.z);
      dynamic.add(mesh);
      unitMeshes.set(u.id, mesh);
    }
    for (const [id, obj] of unitMeshes)
      if (!seenUnits.has(id)) {
        dynamic.remove(obj);
        unitMeshes.delete(id);
      }
    draw();
  };

  const dispose = () => {
    ro.disconnect();
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointerup', onClick);
    scene.traverse((o) => {
      if (o instanceof Mesh || o instanceof LineSegments) {
        o.geometry.dispose();
        const m = o.material as Material | Material[];
        for (const x of Array.isArray(m) ? m : [m]) x.dispose();
      }
    });
    for (const g of geoCache.values()) g.dispose();
    for (const m of matCache.values()) m.dispose();
    hoverMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { update, dispose };
}
