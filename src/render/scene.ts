import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
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
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material } from 'three';
import { visualOf } from '../ui/entity/model';
import type { PreviewShape } from '../ui/entity/model';
import { DT, effectiveGroupStats } from '../sim';
import type { Content, MissionConfig, SimState, Vec2, VisualConfig } from '../sim';
import { cellToWorld, fitView, ISO_FORWARD, pickCell } from './coords';
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
  /** Выделить зону группы (GroupState.id); null — снять выделение. */
  setSelectedGroup(group: number | null): void;
  dispose(): void;
}

export interface SceneOptions {
  /** Клик по клетке карты: выбранная группа получает туда зону. */
  onMapClick?: (cell: Vec2) => void;
}

const COLORS = {
  background: 0x10151c,
  ground: 0x2b3a2f,
  grid: 0x3c4f41,
  path: 0x8a7a55,
  spawn: 0xb5533c,
  base: 0x3d9c6b,
  zoneSelected: 0xffd166,
  airfield: 0x6b7480,
  airfieldMark: 0xe8e8e8,
  hpBack: 0x1a1f26,
  hpFull: 0x4cd07d,
  hpLow: 0xe5484d,
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
  const pathPoints = mission.path ?? [];
  for (let i = 1; i < pathPoints.length; i++) {
    const a = cellToWorld(pathPoints[i - 1]!, size);
    const b = cellToWorld(pathPoints[i]!, size);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const seg = new Mesh(new BoxGeometry(len + PATH_W, 0.04, PATH_W), pathMat);
    seg.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    map.add(seg);
  }

  // Точки входа врагов: начало пути или spawns миссии с целью.
  const spawnMat = new MeshLambertMaterial({ color: COLORS.spawn });
  for (const cell of mission.objective ? (mission.spawns ?? []) : pathPoints.slice(0, 1)) {
    const spawn = new Mesh(new BoxGeometry(0.9, 0.12, 0.9), spawnMat);
    const sp = cellToWorld(cell, size);
    spawn.position.set(sp.x, 0.06, sp.z);
    map.add(spawn);
  }
  // База в конце пути — только в миссиях без цели; цель миссии рисуется из снапшота (ниже).
  const last = mission.objective ? undefined : pathPoints[pathPoints.length - 1];
  if (last) {
    const baseMesh = new Mesh(new BoxGeometry(0.9, 0.7, 0.9), new MeshLambertMaterial({ color: COLORS.base }));
    const bp = cellToWorld(last, size);
    baseMesh.position.set(bp.x, 0.35, bp.z);
    map.add(baseMesh);
  }

  // Аэродром: площадка с полосой на клетке у края карты.
  const ap = cellToWorld(mission.airfield, size);
  const apron = new Mesh(new BoxGeometry(1.5, 0.06, 1.5), new MeshLambertMaterial({ color: COLORS.airfield }));
  apron.position.set(ap.x, 0.03, ap.z);
  const strip = new Mesh(new BoxGeometry(1.3, 0.02, 0.14), new MeshLambertMaterial({ color: COLORS.airfieldMark }));
  strip.position.set(ap.x, 0.07, ap.z);
  map.add(apron, strip);

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
    x: Tween;
    y: Tween;
  }
  interface Dying {
    mesh: Mesh;
    scale: number;
    start: number;
  }
  interface GroupEntry {
    mesh: Mesh;
    scale: number;
    /** Момент последнего выстрела — для импульса отдачи. */
    recoilStart: number;
    /** Высота полёта над землёй; на аэродроме (взлёт, перезарядка) — на земле. */
    lift: number;
    x: Tween;
    y: Tween;
    onGround: boolean;
    zone: Mesh;
    zoneRing: Mesh;
    zoneMat: MeshBasicMaterial;
    ringMat: MeshBasicMaterial;
    zoneColor: Color;
  }
  const groups = new Map<number, GroupEntry>();
  let selectedGroup: number | null = null;
  const enemies = new Map<number, EnemyEntry>();
  const dying: Dying[] = [];
  const live: { spec: EffectSpec; obj: Mesh; mat: MeshBasicMaterial; start: number }[] = [];
  const dynamic = new Group();
  scene.add(dynamic);
  const baseWorld = last ? cellToWorld(last, size, 0.4) : undefined;

  // Цель миссии (объект или колонна) с полосой прочности; позиция и прочность — из снапшота.
  const HP_W = 1.2;
  const goal = mission.objective
    ? {
        body: new Mesh(new BoxGeometry(0.8, 0.6, 0.8), new MeshLambertMaterial({ color: COLORS.base })),
        back: new Mesh(new BoxGeometry(HP_W + 0.08, 0.16, 0.06), new MeshBasicMaterial({ color: COLORS.hpBack })),
        fill: new Mesh(new BoxGeometry(HP_W, 0.1, 0.1), new MeshBasicMaterial({ color: COLORS.hpFull })),
        maxHp: mission.objective.hp,
        ratio: 1,
        x: undefined as Tween | undefined,
        y: undefined as Tween | undefined,
      }
    : undefined;
  if (goal) scene.add(goal.body, goal.back, goal.fill);
  const goalWorld = (now: number): Vec3 | undefined =>
    goal?.x && goal.y ? cellToWorld({ x: tweenValue(goal.x, now), y: tweenValue(goal.y, now) }, size, 0.3) : undefined;
  const placeGoal = (now: number) => {
    const p = goalWorld(now);
    if (!goal || !p) return;
    goal.body.position.set(p.x, p.y, p.z);
    goal.back.position.set(p.x, p.y + 0.75, p.z);
    // Полоса убывает к левому краю: масштаб по X со сдвигом центра.
    goal.fill.scale.x = Math.max(goal.ratio, 1e-4);
    goal.fill.position.set(p.x - (HP_W * (1 - goal.ratio)) / 2, p.y + 0.75, p.z);
    (goal.fill.material as MeshBasicMaterial).color.set(goal.ratio > 0.35 ? COLORS.hpFull : COLORS.hpLow);
  };
  const clock = () => performance.now();
  const DYING_MS = 320;
  const RECOIL_MS = 140;

  // Эффекты: общие единичные геометрии, материал на эффект (гаснет по прозрачности) — освобождается по окончании.
  const tracerGeo = new CylinderGeometry(0.06, 0.06, 1, 6);
  const burstGeo = new SphereGeometry(1, 12, 8);
  const UP = new Vector3(0, 1, 0);

  const enemyWorld = (e: EnemyEntry, now: number): Vec3 =>
    cellToWorld({ x: tweenValue(e.x, now), y: tweenValue(e.y, now) }, size, e.lift);

  // Круг зоны: единичный диск и кольцо в плоскости земли, масштабируются до радиуса группы.
  const zoneDiscGeo = new CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  const zoneRingGeo = new RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2);
  const ZONE_Y = 0.1;
  const groupWorld = (g: GroupEntry, now: number): Vec3 =>
    cellToWorld({ x: tweenValue(g.x, now), y: tweenValue(g.y, now) }, size, g.onGround ? 0.08 : g.lift);
  const paintZone = (g: GroupEntry, selected: boolean) => {
    const c = selected ? COLORS.zoneSelected : g.zoneColor;
    g.zoneMat.color.set(c);
    g.ringMat.color.set(c);
    g.zoneMat.opacity = selected ? 0.22 : 0.1;
    g.ringMat.opacity = selected ? 1 : 0.6;
  };

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

  /** Анимации по времени: движение врагов и групп, отдача групп при выстреле, гибель, эффекты. */
  const animate = (now: number) => {
    placeGoal(now);
    for (const e of enemies.values()) {
      const p = enemyWorld(e, now);
      e.mesh.position.set(p.x, p.y, p.z);
    }
    for (const g of groups.values()) {
      const p = groupWorld(g, now);
      g.mesh.position.set(p.x, p.y, p.z);
      const k = effectProgress(g.recoilStart, RECOIL_MS, now);
      g.mesh.scale.setScalar(g.scale * (k === null ? 1 : recoilScale(k)));
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

  const cellAtEvent = (e: PointerEvent): Vec2 | null => {
    const r = renderer.domElement.getBoundingClientRect();
    return pickCell({ x: e.clientX - r.left, y: e.clientY - r.top }, view, size);
  };
  const onClick = (e: PointerEvent) => {
    const cell = cellAtEvent(e);
    if (cell) options.onMapClick?.(cell);
  };
  const el = renderer.domElement;
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
        entry = { mesh, lift, scale, x: retarget(undefined, e.pos.x, now, 0), y: retarget(undefined, e.pos.y, now, 0) };
        enemies.set(e.id, entry);
      } else if (isNew) {
        entry.x = retarget(entry.x, e.pos.x, now, duration);
        entry.y = retarget(entry.y, e.pos.y, now, duration);
      }
    }

    if (goal && state.objective) {
      const o = state.objective;
      if (!goal.x || isNew) {
        goal.x = retarget(goal.x, o.pos.x, now, goal.x ? duration : 0);
        goal.y = retarget(goal.y, o.pos.y, now, goal.y ? duration : 0);
      }
      goal.ratio = Math.max(0, Math.min(1, o.hp / goal.maxHp));
    }

    const seenGroups = new Set<number>();
    for (const g of state.groups) {
      seenGroups.add(g.id);
      const cfg = content.groups[g.type];
      if (!cfg) continue;
      const onGround = g.phase === 'takeoff' || g.phase === 'rearm';
      let entry = groups.get(g.id);
      if (!entry) {
        const { mesh, lift, scale } = bodyMesh({ role: cfg.role, tags: cfg.tags, visual: cfg.visual });
        const zoneColor = new Color(cfg.visual?.color ?? '#ffffff');
        const zoneMat = new MeshBasicMaterial({ color: zoneColor, transparent: true, depthWrite: false });
        const ringMat = new MeshBasicMaterial({ color: zoneColor, transparent: true, depthWrite: false });
        const zone = new Mesh(zoneDiscGeo, zoneMat);
        const zoneRing = new Mesh(zoneRingGeo, ringMat);
        zone.renderOrder = zoneRing.renderOrder = 1;
        dynamic.add(mesh, zone, zoneRing);
        entry = {
          mesh,
          scale,
          recoilStart: -1e9,
          lift,
          x: retarget(undefined, g.pos.x, now, 0),
          y: retarget(undefined, g.pos.y, now, 0),
          onGround,
          zone,
          zoneRing,
          zoneMat,
          ringMat,
          zoneColor,
        };
        groups.set(g.id, entry);
        paintZone(entry, selectedGroup === g.id);
      } else if (isNew) {
        entry.x = retarget(entry.x, g.pos.x, now, duration);
        entry.y = retarget(entry.y, g.pos.y, now, duration);
        entry.onGround = onGround;
      }
      // Радиус с аурами союзников (например, ДРЛО) — тот же расчёт, что в sim.
      const radius = effectiveGroupStats({ content, state }, g).zoneRadius;
      const zp = cellToWorld(g.zone, size, ZONE_Y);
      for (const m of [entry.zone, entry.zoneRing]) {
        m.position.set(zp.x, zp.y, zp.z);
        m.scale.set(radius, 1, radius);
      }
    }

    // События снапшота -> эффекты; позиции врагов берутся до их удаления из сцены.
    if (isNew) {
      const plan = planEffects(state.events, {
        groupPos: (id) => {
          const g = groups.get(id);
          return g && groupWorld(g, now);
        },
        enemyPos: (id) => {
          const e = enemies.get(id);
          return e && enemyWorld(e, now);
        },
        basePos: goalWorld(now) ?? baseWorld ?? { x: 0, y: 0, z: 0 },
      });
      for (const spec of plan.effects) spawnEffect(spec, now);
      for (const id of plan.fired) {
        const g = groups.get(id);
        if (g) g.recoilStart = now;
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
    for (const [id, entry] of groups)
      if (!seenGroups.has(id)) {
        dynamic.remove(entry.mesh, entry.zone, entry.zoneRing);
        entry.zoneMat.dispose();
        entry.ringMat.dispose();
        groups.delete(id);
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
    zoneDiscGeo.dispose();
    zoneRingGeo.dispose();
    for (const g of geoCache.values()) g.dispose();
    for (const m of matCache.values()) m.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  const setSelectedGroup = (group: number | null) => {
    if (group === selectedGroup) return;
    selectedGroup = group;
    for (const [id, entry] of groups) paintZone(entry, id === group);
    draw();
  };

  return { update, setSelectedGroup, dispose };
}
