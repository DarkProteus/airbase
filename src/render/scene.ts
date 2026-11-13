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
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material } from 'three';
import { visualOf } from '../ui/entity/model';
import type { PreviewShape } from '../ui/entity/model';
import { buildPath, DT, pointAt } from '../sim';
import type { Content, MissionConfig, SimState, VisualConfig } from '../sim';
import { cellToWorld, fitView, ISO_FORWARD, pickCell, slotIndexAt } from './coords';
import type { IsoView } from './coords';
import { dyingScale, effectProgress, planEffects, recoilScale } from './effects';
import type { EffectSpec, Vec3 } from './effects';
import { retarget, tweenDuration, tweenValue } from './motion';
import type { Tween } from './motion';

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
  const bodyMesh = (entity: { role?: string; tags: readonly string[]; visual?: VisualConfig }) => {
    const v = visualOf(entity);
    let geo = geoCache.get(v.shape);
    if (!geo) geoCache.set(v.shape, (geo = shapeGeometry(v.shape)));
    let mat = matCache.get(v.color);
    if (!mat) matCache.set(v.color, (mat = new MeshLambertMaterial({ color: new Color(v.color) })));
    const m = new Mesh(geo, mat);
    m.scale.setScalar(v.size);
    return { mesh: m, lift: v.altitude, scale: v.size };
  };

  interface EnemyEntry {
    mesh: Mesh;
    lift: number;
    scale: number;
    dist: Tween;
  }
  interface UnitEntry {
    mesh: Mesh;
    scale: number;
    pos: Vec3;
    recoilStart: number;
  }
  interface Dying {
    mesh: Mesh;
    scale: number;
    start: number;
  }
  const enemies = new Map<number, EnemyEntry>();
  const units = new Map<number, UnitEntry>();
  const dying: Dying[] = [];
  const live: { spec: EffectSpec; obj: Mesh; mat: MeshBasicMaterial; start: number }[] = [];
  const dynamic = new Group();
  scene.add(dynamic);
  const baseWorld = cellToWorld(last, size, 0.4);
  const clock = () => performance.now();
  const DYING_MS = 320;
  const RECOIL_MS = 140;

  // Эффекты: общие единичные геометрии, материал на эффект (гаснет по прозрачности) — освобождается по окончании.
  const tracerGeo = new CylinderGeometry(0.06, 0.06, 1, 6);
  const burstGeo = new SphereGeometry(1, 12, 8);
  const UP = new Vector3(0, 1, 0);

  const enemyWorld = (e: EnemyEntry, now: number): Vec3 =>
    cellToWorld(pointAt(path, tweenValue(e.dist, now)), size, e.lift);

  const spawnEffect = (spec: EffectSpec, now: number) => {
    const mat = new MeshBasicMaterial({ color: spec.color, transparent: true, depthWrite: false });
    const obj = new Mesh(spec.kind === 'tracer' ? tracerGeo : burstGeo, mat);
    if (spec.kind === 'tracer') {
      const dir = new Vector3(spec.to.x - spec.from.x, spec.to.y - spec.from.y, spec.to.z - spec.from.z);
      const len = dir.length();
      obj.position.set((spec.from.x + spec.to.x) / 2, (spec.from.y + spec.to.y) / 2, (spec.from.z + spec.to.z) / 2);
      if (len > 1e-6) obj.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      obj.scale.set(1, len, 1);
    } else {
      obj.position.set(spec.at.x, spec.at.y, spec.at.z);
    }
    dynamic.add(obj);
    live.push({ spec, obj, mat, start: now });
  };

  /** Анимации по времени: движение врагов, отдача юнитов, гибель, эффекты. */
  const animate = (now: number) => {
    for (const e of enemies.values()) {
      const p = enemyWorld(e, now);
      e.mesh.position.set(p.x, p.y, p.z);
    }
    for (const u of units.values()) {
      const k = effectProgress(u.recoilStart, RECOIL_MS, now);
      u.mesh.scale.setScalar(u.scale * (k === null ? 1 : recoilScale(k)));
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i]!;
      const k = effectProgress(d.start, DYING_MS, now);
      if (k === null) {
        dynamic.remove(d.mesh);
        dying.splice(i, 1);
      } else d.mesh.scale.setScalar(Math.max(1e-3, d.scale * dyingScale(k)));
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i]!;
      const k = effectProgress(f.start, f.spec.ttl, now);
      if (k === null) {
        dynamic.remove(f.obj);
        f.mat.dispose();
        live.splice(i, 1);
      } else if (f.spec.kind === 'burst') {
        f.obj.scale.setScalar(f.spec.radius * (0.35 + 0.65 * k));
        f.mat.opacity = 0.9 * (1 - k);
      } else f.mat.opacity = 1 - k;
    }
  };

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

  let lastTick = -1;
  const update = (state: SimState) => {
    const now = clock();
    // Движение растягивается ровно на тики между снапшотами (но не больше 8: после паузы вкладки не «ползём»).
    const duration = tweenDuration(Math.min(8, Math.max(1, state.tick - lastTick)), DT);
    const isNew = state.tick !== lastTick;

    const seenEnemies = new Set<number>();
    for (const e of state.enemies) {
      seenEnemies.add(e.id);
      let entry = enemies.get(e.id);
      if (!entry) {
        const cfg = content.enemies[e.type];
        const { mesh, lift, scale } = bodyMesh({ tags: cfg?.tags ?? [e.type], visual: cfg?.visual });
        dynamic.add(mesh);
        entry = { mesh, lift, scale, dist: retarget(undefined, e.dist, now, 0) };
        enemies.set(e.id, entry);
      } else if (isNew) entry.dist = retarget(entry.dist, e.dist, now, duration);
    }

    const seenUnits = new Set<number>();
    for (const u of state.units) {
      seenUnits.add(u.id);
      if (units.has(u.id)) continue;
      const cfg = content.units[u.type];
      const slot = mission.slots[u.slot];
      if (!cfg || !slot) continue;
      const { mesh, lift, scale } = bodyMesh({ role: cfg.role, tags: cfg.tags, visual: cfg.visual });
      const p = cellToWorld(slot, size, 0.08 + lift);
      mesh.position.set(p.x, p.y, p.z);
      dynamic.add(mesh);
      units.set(u.id, { mesh, scale, pos: p, recoilStart: -1e9 });
    }

    // События снапшота -> эффекты; позиции врагов берутся до их удаления из сцены.
    if (isNew) {
      const plan = planEffects(state.events, {
        unitPos: (id) => units.get(id)?.pos,
        enemyPos: (id) => {
          const e = enemies.get(id);
          return e && enemyWorld(e, now);
        },
        basePos: baseWorld,
      });
      for (const spec of plan.effects) spawnEffect(spec, now);
      for (const id of plan.fired) {
        const u = units.get(id);
        if (u) u.recoilStart = now;
      }
      for (const id of plan.killed) {
        const e = enemies.get(id);
        if (!e) continue;
        const p = enemyWorld(e, now);
        e.mesh.position.set(p.x, p.y, p.z);
        dying.push({ mesh: e.mesh, scale: e.scale, start: now });
        enemies.delete(id);
      }
    }
    lastTick = state.tick;

    for (const [id, entry] of enemies)
      if (!seenEnemies.has(id)) {
        dynamic.remove(entry.mesh);
        enemies.delete(id);
      }
    for (const [id, entry] of units)
      if (!seenUnits.has(id)) {
        dynamic.remove(entry.mesh);
        units.delete(id);
      }
    animate(now);
    draw();
  };

  // Непрерывный цикл: плавное движение между тиками и эффекты не зависят от частоты снапшотов.
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    animate(clock());
    draw();
  };
  raf = requestAnimationFrame(loop);

  const dispose = () => {
    cancelAnimationFrame(raf);
    for (const f of live) f.mat.dispose();
    live.length = 0;
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
    tracerGeo.dispose();
    burstGeo.dispose();
    for (const g of geoCache.values()) g.dispose();
    for (const m of matCache.values()) m.dispose();
    hoverMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { update, dispose };
}
