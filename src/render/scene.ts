import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import { visualOf } from '../ui/entity/model';
import { attackLinks, enemyMarks, TARGET_KINDS, targetKind } from '../ui/game/markup';
import type { EnemyMark, TargetKind } from '../ui/game/markup';
import type { PreviewShape } from '../ui/entity/model';
import { DT, effectiveGroupStats, objectiveRoute, rearmTicksLeft, toTicks } from '../sim';
import type { PathData } from '../sim';
import type { Content, MissionConfig, SimState, SortiePhase, Vec2, VisualConfig } from '../sim';
import { cellToWorld, fitView, ISO_FORWARD, pickCell } from './coords';
import type { IsoView } from './coords';
import { buildConvoyCars, buildEnvironment, buildHeadquarters, setShadows } from './environmentScene';
import { routeDots, routePose } from './environment';
import { CONVOY_GAP } from './props';
import { auraZones, waveLook, wavePhase } from './auras';
import type { AuraZone } from './auras';
import { blastSize, debrisAt, dyingScale, effectProgress, EFFECT_COLORS, missilePath, planEffects, recoilScale, shotKindOf, shotWeapon, trimEffects } from './effects';
import type { EffectSpec, Vec3 } from './effects';
import { groupPose, initialTrack, nextTrack, runwayFrame } from './flight';
import type { FlightTrack } from './flight';
import { buildModel } from './model';
import { headingOf, retarget, turnToward, tweenDuration, tweenValue } from './motion';
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
  /** Подсветить точки входа ближайшей волны (с подписью; пустая подпись — только кольцо); пустой список — убрать. */
  setWarning(points: readonly { at: Vec2; label: string }[]): void;
  /** Вражеские базы: постоянная подпись и модели типов врагов, которые база уже выпускает. */
  setBases(bases: readonly { at: Vec2; name: string; types: readonly string[] }[]): void;
  /** Маршруты врагов ближайшей волны: точки вдоль ломаных, цвет — по типу цели (воздух/земля); пустой список — убрать. */
  setRoutes(routes: readonly { kind: TargetKind; points: readonly Vec2[] }[]): void;
  dispose(): void;
}

export interface SceneOptions {
  /** Клик по клетке карты: выбранная группа получает туда зону. */
  onMapClick?: (cell: Vec2) => void;
}

const COLORS = {
  background: 0x10151c,
  zoneSelected: 0xffd166,
  hpBack: 0x1a1f26,
  hpFull: 0x4cd07d,
  hpLow: 0xe5484d,
  kindAir: 0x6ec1ff,
  kindGround: 0xe0a458,
  warning: 0xff7a45,
};

/** Цвет метки типа цели; тип задают теги конфига (см. TARGET_KINDS). */
const KIND_COLORS: Record<TargetKind, number> = { air: COLORS.kindAir, ground: COLORS.kindGround };
const BAR_W = 0.85;
const BAR_H = 0.12;

const CAMERA_DISTANCE = 40;
/** Скорость доворота сущности на курс, рад/с. */
const TURN_RATE = 6;

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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 0.95));
  // Солнце слева-сзади относительно камеры: тени падают вправо-вниз по экрану. Теневая камера накрывает карту с запасом.
  const sun = new DirectionalLight(0xfff4e0, 1.25);
  sun.position.set(-14, 22, 10);
  const shadowR = Math.hypot(size.w, size.h) / 2 + 4;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -shadowR;
  sun.shadow.camera.right = sun.shadow.camera.top = shadowR;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // Камера: фиксированная ортографическая изометрия, параметры окна считаются в coords.ts.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(-ISO_FORWARD.x * CAMERA_DISTANCE, -ISO_FORWARD.y * CAMERA_DISTANCE, -ISO_FORWARD.z * CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  let view: IsoView = fitView(size, 1, 1);

  // --- статика карты ---
  const map = new Group();
  scene.add(map);

  // Земля, дорога, аэродром, ворота входов, декор — раскладка из MissionConfig (см. environment.ts).
  const env = buildEnvironment(mission);
  map.add(env.group);
  const pathPoints = mission.path ?? [];
  // Конец пути (миссии без цели) — для курса врагов и позиции базы; здание рисует buildEnvironment.
  const last = mission.objective ? undefined : pathPoints[pathPoints.length - 1];

  // --- динамика: сущности снапшота ---
  const geoCache = new Map<PreviewShape, BufferGeometry>();
  const matCache = new Map<string, Material>();
  const bodyMesh = (entity: { role?: string; tags: readonly string[]; visual?: VisualConfig }) => {
    const v = visualOf(entity);
    if (v.model) {
      const model: Object3D = buildModel(v.model, v.color);
      model.scale.setScalar(v.size);
      setShadows(model, true, false);
      return { mesh: model, lift: v.altitude, scale: v.size };
    }
    let geo = geoCache.get(v.shape);
    if (!geo) geoCache.set(v.shape, (geo = shapeGeometry(v.shape)));
    let mat = matCache.get(v.color);
    if (!mat) matCache.set(v.color, (mat = new MeshLambertMaterial({ color: new Color(v.color) })));
    const m: Object3D = new Mesh(geo, mat);
    m.castShadow = true;
    m.scale.setScalar(v.size);
    return { mesh: m, lift: v.altitude, scale: v.size };
  };

  interface EnemyEntry {
    mesh: Object3D;
    /** Курс: показанный и целевой угол вокруг вертикали (нос модели — по движению). */
    heading: number;
    headingTo: number;
    lift: number;
    scale: number;
    x: Tween;
    y: Tween;
    /** Полоска здоровья + метка типа цели (плашка к камере). */
    bar: Bar;
    /** Теги конфига (какое оружие бьёт эту цель) и габарит взрыва (из прочности и масштаба). */
    tags: readonly string[];
    blast: number;
    /** Момент последнего попадания — для встряски. */
    hitStart: number;
  }
  interface Bar {
    root: Group;
    fill: Mesh;
    mats: MeshBasicMaterial[];
    fillMat: MeshBasicMaterial;
  }
  interface Dying {
    mesh: Object3D;
    scale: number;
    start: number;
  }
  type FxPool = 'tracer' | 'sphere' | 'ring' | 'box';
  /** Объект эффекта из пула: меш с собственным материалом, переиспользуется. */
  interface Fx {
    obj: Mesh;
    mat: MeshBasicMaterial;
  }
  interface AuraEntry {
    zone: AuraZone;
    waves: { mesh: Mesh; mat: MeshBasicMaterial }[];
    disc: { mesh: Mesh; mat: MeshBasicMaterial };
  }
  interface GroupEntry {
    mesh: Object3D;
    heading: number;
    headingTo: number;
    scale: number;
    /** Момент последнего выстрела — для импульса отдачи. */
    recoilStart: number;
    /** Высота полёта над землёй (эшелон). */
    lift: number;
    /** Тип группы (ключ конфига) и фаза вылета в прошлом снапшоте. */
    type: string;
    phase: SortiePhase;
    /** Показанная клетка и доля эшелона 0..1 (0 — на земле): траектория по полосе, см. flight.ts. */
    x: Tween;
    y: Tween;
    h: Tween;
    track: FlightTrack;
    /** Клетка в прошлом кадре — курс берётся из фактического смещения. */
    px?: number;
    py?: number;
    zone: Mesh;
    zoneRing: Mesh;
    zoneMat: MeshBasicMaterial;
    ringMat: MeshBasicMaterial;
    zoneColor: Color;
  }
  const groups = new Map<number, GroupEntry>();
  const groupColors = new Map<number, number>();
  let selectedGroup: number | null = null;
  const enemies = new Map<number, EnemyEntry>();
  const dying: Dying[] = [];
  const live: { spec: EffectSpec; fx: Fx; pool: FxPool; start: number }[] = [];
  const dynamic = new Group();
  scene.add(dynamic);
  const baseWorld = last ? cellToWorld(last, size, 0.4) : undefined;

  // Полоска здоровья врага: плашки смотрят в камеру, поэтому полоса всегда горизонтальна на экране.
  const planeGeo = new PlaneGeometry(1, 1);
  const makeBar = (kind: TargetKind | undefined): Bar => {
    const root = new Group();
    root.quaternion.copy(camera.quaternion);
    const mat = (color: number) => new MeshBasicMaterial({ color, transparent: true, depthTest: false });
    const backMat = mat(COLORS.hpBack);
    const fillMat = mat(COLORS.hpFull);
    const mats = [backMat, fillMat];
    const part = (m: MeshBasicMaterial, w: number, h: number, z: number) => {
      const mesh = new Mesh(planeGeo, m);
      mesh.scale.set(w, h, 1);
      mesh.position.z = z;
      mesh.renderOrder = 5 + z * 1000;
      root.add(mesh);
      return mesh;
    };
    part(backMat, BAR_W + 0.06, BAR_H + 0.05, 0);
    const fill = part(fillMat, BAR_W, BAR_H, 0.001);
    if (kind) {
      // Воздух — ромб, земля — квадрат; цвет тоже по типу.
      const markMat = mat(KIND_COLORS[kind]);
      mats.push(markMat);
      const mark = part(markMat, 0.2, 0.2, 0.002);
      mark.position.x = -(BAR_W / 2 + 0.16);
      if (kind === 'air') mark.rotation.z = Math.PI / 4;
    }
    return { root, fill, mats, fillMat };
  };
  const paintBar = (b: Bar, m: EnemyMark) => {
    b.fill.scale.x = Math.max(m.ratio, 1e-3) * BAR_W;
    b.fill.position.x = -(BAR_W * (1 - m.ratio)) / 2;
    b.fillMat.color.set(m.ratio > 0.35 ? COLORS.hpFull : COLORS.hpLow);
    // Выбрана группа — враги, которых она не может бить, тускнеют.
    // Необнаруженный малозаметный враг тоже тусклый: его сейчас не атакует никто.
    for (const x of b.mats) x.opacity = m.hittable === false || m.hidden ? 0.3 : 1;
  };
  const removeBar = (b: Bar) => {
    dynamic.remove(b.root);
    for (const x of b.mats) x.dispose();
  };

  // Связи «группа -> цель»: тонкий луч цвета группы, пока она недавно стреляла по живому врагу.
  const links = new Map<number, { mesh: Mesh; mat: MeshBasicMaterial }>();
  let linkSpecs: { group: number; enemy: number; color: Color }[] = [];

  // Точки входа ближайшей волны: пульсирующее кольцо и подпись.
  const warnRingGeo = new RingGeometry(0.55, 0.75, 32).rotateX(-Math.PI / 2);
  const warnMat = new MeshBasicMaterial({ color: COLORS.warning, transparent: true, depthWrite: false });
  let warnRings: Mesh[] = [];
  let warnKey = '[]';
  let warnLabels: { el: HTMLElement; world: Vector3 }[] = [];
  const labelLayer = document.createElement('div');
  labelLayer.className = 'scene-labels';
  container.appendChild(labelLayer);
  // Вражеские базы: подписи живут в своём слое (предупреждение о волне свой слой перерисовывает целиком).
  const baseLayer = document.createElement('div');
  baseLayer.className = 'scene-labels';
  container.appendChild(baseLayer);
  const baseProps = new Group();
  dynamic.add(baseProps);
  let baseLabels: { el: HTMLElement; world: Vector3 }[] = [];
  let baseKey = '';

  // Маршруты ближайшей волны: плоские точки на земле, по одному набору на тип цели.
  const ROUTE_DOTS = 512;
  const routeGeo = new CircleGeometry(0.085, 10).rotateX(-Math.PI / 2);
  const routeMeshes = TARGET_KINDS.map((kind) => {
    const mesh = new InstancedMesh(routeGeo, new MeshBasicMaterial({ color: KIND_COLORS[kind], transparent: true, opacity: 0.85, depthWrite: false }), ROUTE_DOTS);
    mesh.count = 0;
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    dynamic.add(mesh);
    return { kind, mesh };
  });
  let routeKey = '[]';

  // Цель миссии (объект или колонна) с полосой прочности; позиция и прочность — из снапшота.
  const HP_W = 1.2;
  // Здание (defend) стоит на месте цели; колонна (escort) — машины едут по маршруту, голова в позиции цели.
  const route: PathData | undefined = mission.objective && objectiveRoute(mission.objective);
  const goal = mission.objective
    ? {
        body: route ? new Group() : buildHeadquarters(),
        cars: route ? buildConvoyCars() : [],
        /** Высота полосы прочности над землёй. */
        barY: route ? 0.85 : 1.45,
        back: new Mesh(new BoxGeometry(HP_W + 0.08, 0.16, 0.06), new MeshBasicMaterial({ color: COLORS.hpBack })),
        fill: new Mesh(new BoxGeometry(HP_W, 0.1, 0.1), new MeshBasicMaterial({ color: COLORS.hpFull })),
        maxHp: mission.objective.hp,
        ratio: 1,
        x: undefined as Tween | undefined,
        y: undefined as Tween | undefined,
        /** Пройденный путь колонны по маршруту. */
        prog: undefined as Tween | undefined,
      }
    : undefined;
  if (goal) {
    for (const car of goal.cars) goal.body.add(car);
    scene.add(goal.body, goal.back, goal.fill);
  }
  const goalWorld = (now: number): Vec3 | undefined =>
    goal?.x && goal.y ? cellToWorld({ x: tweenValue(goal.x, now), y: tweenValue(goal.y, now) }, size, 0.3) : undefined;
  const placeGoal = (now: number) => {
    const p = goalWorld(now);
    if (!goal || !p) return;
    if (route && goal.prog) {
      const d = tweenValue(goal.prog, now);
      goal.cars.forEach((car, i) => {
        const pose = routePose(route, d - i * CONVOY_GAP);
        const w = cellToWorld(pose.at, size, 0.05);
        car.position.set(w.x, w.y, w.z);
        car.rotation.y = pose.heading;
      });
    } else goal.body.position.set(p.x, 0.01, p.z);
    const by = goal.barY;
    goal.back.position.set(p.x, by, p.z);
    // Полоса убывает к левому краю: масштаб по X со сдвигом центра.
    goal.fill.scale.x = Math.max(goal.ratio, 1e-4);
    goal.fill.position.set(p.x - (HP_W * (1 - goal.ratio)) / 2, by, p.z);
    (goal.fill.material as MeshBasicMaterial).color.set(goal.ratio > 0.35 ? COLORS.hpFull : COLORS.hpLow);
  };
  const clock = () => performance.now();
  const DYING_MS = 220;
  const RECOIL_MS = 140;
  const HIT_MS = 120;
  /** Сколько эффектов живёт одновременно; сверх — отбрасываются дым и осколки (см. trimEffects). */
  const MAX_EFFECTS = 160;

  // Эффекты: общие единичные геометрии и пул мешей с материалами — по окончании эффект не удаляется, а прячется и ждёт повторного использования.
  const tracerGeo = new CylinderGeometry(0.06, 0.06, 1, 6);
  const burstGeo = new SphereGeometry(1, 12, 8);
  const fxRingGeo = new RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
  const fxBoxGeo = new BoxGeometry(1, 1, 1);
  const fxGeo: Record<FxPool, BufferGeometry> = { tracer: tracerGeo, sphere: burstGeo, ring: fxRingGeo, box: fxBoxGeo };
  const fxFree: Record<FxPool, Fx[]> = { tracer: [], sphere: [], ring: [], box: [] };
  const poolOf = (kind: EffectSpec['kind']): FxPool =>
    kind === 'tracer' || kind === 'missile' ? 'tracer' : kind === 'ring' ? 'ring' : kind === 'debris' ? 'box' : 'sphere';
  const UP = new Vector3(0, 1, 0);
  const tmpDir = new Vector3();

  const enemyWorld = (e: EnemyEntry, now: number): Vec3 =>
    cellToWorld({ x: tweenValue(e.x, now), y: tweenValue(e.y, now) }, size, e.lift);

  // Круг зоны: единичный диск и кольцо в плоскости земли, масштабируются до радиуса группы.
  const zoneDiscGeo = new CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  const zoneRingGeo = new RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2);
  const ZONE_Y = 0.1;
  const AURA_Y = 0.13;
  // Круг ауры: две бегущие волны и мягкое пульсирующее заполнение, цвет — владельца (чуть светлее его зоны).
  const waveGeo = new RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
  const auraMeshes = new Map<string, AuraEntry>();
  const runway = runwayFrame(mission);
  const GROUND_Y = 0.08;
  const groupWorld = (g: GroupEntry, now: number): Vec3 =>
    cellToWorld({ x: tweenValue(g.x, now), y: tweenValue(g.y, now) }, size, GROUND_Y + (Math.max(g.lift, GROUND_Y) - GROUND_Y) * tweenValue(g.h, now));
  const paintZone = (g: GroupEntry, selected: boolean) => {
    const c = selected ? COLORS.zoneSelected : g.zoneColor;
    g.zoneMat.color.set(c);
    g.ringMat.color.set(c);
    g.zoneMat.opacity = selected ? 0.22 : 0.1;
    g.ringMat.opacity = selected ? 1 : 0.6;
  };

  /** Единичный цилиндр -> луч от from до to; thick — множитель толщины. */
  const aim = (obj: Mesh, from: Vec3, to: Vec3, thick = 1) => {
    const dir = tmpDir.set(to.x - from.x, to.y - from.y, to.z - from.z);
    const len = dir.length();
    obj.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    if (len > 1e-6) obj.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    obj.scale.set(thick, len, thick);
  };

  const spawnEffect = (spec: EffectSpec, now: number) => {
    const pool = poolOf(spec.kind);
    let fx = fxFree[pool].pop();
    if (!fx) {
      const mat = new MeshBasicMaterial({ transparent: true, depthWrite: false });
      const obj = new Mesh(fxGeo[pool], mat);
      obj.renderOrder = 4;
      obj.frustumCulled = false;
      dynamic.add(obj);
      fx = { obj, mat };
    }
    fx.mat.color.set(spec.color);
    fx.mat.opacity = 0;
    fx.obj.visible = false;
    fx.obj.rotation.set(0, 0, 0);
    fx.obj.quaternion.identity();
    live.push({ spec, fx, pool, start: now + (spec.delay ?? 0) });
  };

  /** Один кадр эффекта: положение, размер и прозрачность по доле жизни k. */
  const paintEffect = (spec: EffectSpec, fx: Fx, k: number, ageMs: number) => {
    const { obj, mat } = fx;
    switch (spec.kind) {
      case 'tracer': {
        // Короткий яркий штрих бежит от группы к цели.
        const d = Math.hypot(spec.to.x - spec.from.x, spec.to.y - spec.from.y, spec.to.z - spec.from.z) || 1;
        const head = Math.min(1, k * 1.15);
        const tail = Math.max(0, head - 0.7 / d);
        aim(
          obj,
          { x: spec.from.x + (spec.to.x - spec.from.x) * tail, y: spec.from.y + (spec.to.y - spec.from.y) * tail, z: spec.from.z + (spec.to.z - spec.from.z) * tail },
          { x: spec.from.x + (spec.to.x - spec.from.x) * head, y: spec.from.y + (spec.to.y - spec.from.y) * head, z: spec.from.z + (spec.to.z - spec.from.z) * head },
          2.2,
        );
        mat.opacity = k < 0.85 ? 1 : (1 - k) / 0.15;
        break;
      }
      case 'missile': {
        const f = missilePath(k);
        const f0 = Math.max(0, f - 0.35 / (Math.hypot(spec.to.x - spec.from.x, spec.to.y - spec.from.y, spec.to.z - spec.from.z) || 1));
        const at = (t: number): Vec3 => ({ x: spec.from.x + (spec.to.x - spec.from.x) * t, y: spec.from.y + (spec.to.y - spec.from.y) * t, z: spec.from.z + (spec.to.z - spec.from.z) * t });
        aim(obj, at(f0), at(f), 2.4);
        mat.opacity = 1;
        break;
      }
      case 'burst':
        obj.position.set(spec.at.x, spec.at.y, spec.at.z);
        obj.scale.setScalar(spec.radius * (0.3 + 0.7 * Math.sqrt(k)));
        mat.opacity = 0.95 * (1 - k) ** 1.2;
        break;
      case 'ring':
        obj.position.set(spec.at.x, spec.at.y, spec.at.z);
        obj.scale.set(spec.radius * (0.2 + 0.8 * Math.sqrt(k)), 1, spec.radius * (0.2 + 0.8 * Math.sqrt(k)));
        mat.opacity = 0.8 * (1 - k);
        break;
      case 'smoke':
        obj.position.set(spec.at.x, spec.at.y + 0.35 * k, spec.at.z);
        obj.scale.setScalar(spec.radius * (0.6 + 0.9 * k));
        mat.opacity = 0.55 * (1 - k) ** 1.5;
        break;
      case 'debris': {
        const p = debrisAt(spec.at, spec.vel, ageMs / 1000);
        obj.position.set(p.x, Math.max(0.02, p.y), p.z);
        obj.scale.setScalar(spec.size);
        obj.rotation.set(ageMs * 0.011, ageMs * 0.007, 0);
        mat.opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        break;
      }
    }
  };

  /** Анимации по времени: движение врагов и групп, отдача групп при выстреле, гибель, эффекты. */
  let lastAnimate = -1;
  const animate = (now: number) => {
    // Доворот на курс: не быстрее TURN_RATE, чтобы смена направления не была рывком.
    const turn = lastAnimate < 0 ? Infinity : (Math.max(0, now - lastAnimate) / 1000) * TURN_RATE;
    lastAnimate = now;
    placeGoal(now);
    for (const e of enemies.values()) {
      const p = enemyWorld(e, now);
      e.mesh.position.set(p.x, p.y, p.z);
      e.mesh.rotation.y = e.heading = turnToward(e.heading, e.headingTo, turn);
      const hk = effectProgress(e.hitStart, HIT_MS, now);
      e.mesh.scale.setScalar(e.scale * (hk === null ? 1 : recoilScale(hk)));
      e.bar.root.position.set(p.x, p.y + 0.8 * e.scale + 0.3, p.z);
    }
    for (const l of linkSpecs) {
      const from = groups.get(l.group);
      const to = enemies.get(l.enemy);
      const link = links.get(l.group);
      if (from && to && link) aim(link.mesh, groupWorld(from, now), enemyWorld(to, now), 0.45);
    }
    const pulse = 1 + 0.2 * Math.sin(now / 180);
    for (const r of warnRings) r.scale.set(pulse, 1, pulse);
    for (const l of [...warnLabels, ...baseLabels]) {
      const v = l.world.clone().project(camera);
      l.el.style.transform = `translate(${((v.x + 1) / 2) * container.clientWidth}px, ${((1 - v.y) / 2) * container.clientHeight}px) translate(-50%, -150%)`;
    }
    for (const g of groups.values()) {
      const p = groupWorld(g, now);
      g.mesh.position.set(p.x, p.y, p.z);
      // Курс — по фактическому смещению (разбег, руление, заход), на месте держится прежний.
      const cx = tweenValue(g.x, now);
      const cy = tweenValue(g.y, now);
      if (g.px !== undefined && g.py !== undefined) g.headingTo = headingOf(cx - g.px, cy - g.py) ?? g.headingTo;
      g.px = cx;
      g.py = cy;
      g.mesh.rotation.y = g.heading = turnToward(g.heading, g.headingTo, turn);
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
        f.fx.obj.visible = false;
        fxFree[f.pool].push(f.fx);
        live.splice(i, 1);
      } else if (now < f.start) f.fx.obj.visible = false;
      else {
        f.fx.obj.visible = true;
        paintEffect(f.spec, f.fx, k, now - f.start);
      }
    }
    // Ауры: волны бегут по зоне, пока владелец патрулирует.
    for (const a of auraMeshes.values()) {
      const r = a.zone.radius;
      a.waves.forEach((w, i) => {
        const look = waveLook(wavePhase(now, i * 0.5), a.zone.flow);
        w.mesh.scale.set(r * look.scale, 1, r * look.scale);
        w.mat.opacity = look.opacity;
      });
      a.disc.mesh.scale.set(r, 1, r);
      a.disc.mat.opacity = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(now / 450));
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
  let lastState: SimState | undefined;
  const paintMarks = (state: SimState) => {
    for (const m of enemyMarks(content, state, selectedGroup)) {
      const entry = enemies.get(m.id);
      if (entry) paintBar(entry.bar, m);
    }
  };
  const update = (state: SimState) => {
    lastState = state;
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
        const bar = makeBar(cfg && targetKind(cfg.tags));
        dynamic.add(bar.root);
        // Курс при появлении: к цели миссии (или к базе), дальше — по фактическому движению.
        const to = state.objective?.pos ?? last ?? e.pos;
        const heading = headingOf(to.x - e.pos.x, to.y - e.pos.y) ?? 0;
        entry = {
          mesh,
          lift,
          scale,
          bar,
          tags: cfg?.tags ?? [e.type],
          blast: blastSize(cfg?.hp ?? 30, scale),
          hitStart: -1e9,
          heading,
          headingTo: heading,
          x: retarget(undefined, e.pos.x, now, 0),
          y: retarget(undefined, e.pos.y, now, 0),
        };
        enemies.set(e.id, entry);
      } else if (isNew) {
        entry.x = retarget(entry.x, e.pos.x, now, duration);
        entry.y = retarget(entry.y, e.pos.y, now, duration);
        entry.headingTo = headingOf(entry.x.to - entry.x.from, entry.y.to - entry.y.from) ?? entry.headingTo;
      }
    }

    paintMarks(state);

    if (goal && state.objective) {
      const o = state.objective;
      if (!goal.x || isNew) {
        goal.x = retarget(goal.x, o.pos.x, now, goal.x ? duration : 0);
        goal.y = retarget(goal.y, o.pos.y, now, goal.y ? duration : 0);
        if (route) goal.prog = retarget(goal.prog, o.progress, now, goal.prog ? duration : 0);
      }
      goal.ratio = Math.max(0, Math.min(1, o.hp / goal.maxHp));
    }

    const seenGroups = new Set<number>();
    for (const g of state.groups) {
      seenGroups.add(g.id);
      const cfg = content.groups[g.type];
      if (!cfg) continue;
      if (cfg.visual) groupColors.set(g.id, new Color(cfg.visual.color).getHex());
      let entry = groups.get(g.id);
      // Траектория у аэродрома: поза считается на каждый новый снапшот, между ними рендер плавно доезжает твином.
      const pose = (track: FlightTrack) =>
        groupPose(runway, {
          phase: g.phase,
          phaseTick: g.phaseTick,
          pos: g.pos,
          zone: g.zone,
          takeoffTicks: Math.max(1, toTicks(cfg.takeoffTime)),
          rearmTicks: Math.max(1, g.phaseTick + rearmTicksLeft({ content }, g)),
          slot: state.groups.indexOf(g),
          slots: state.groups.length,
          track,
        });
      if (!entry) {
        const { mesh, lift, scale } = bodyMesh({ role: cfg.role, tags: cfg.tags, visual: cfg.visual });
        const zoneColor = new Color(cfg.visual?.color ?? '#ffffff');
        const zoneMat = new MeshBasicMaterial({ color: zoneColor, transparent: true, depthWrite: false });
        const ringMat = new MeshBasicMaterial({ color: zoneColor, transparent: true, depthWrite: false });
        const zone = new Mesh(zoneDiscGeo, zoneMat);
        const zoneRing = new Mesh(zoneRingGeo, ringMat);
        zone.renderOrder = zoneRing.renderOrder = 1;
        dynamic.add(mesh, zone, zoneRing);
        const track = nextTrack(runway, initialTrack(), undefined, g);
        const p0 = pose(track);
        entry = {
          mesh,
          scale,
          heading: runway.heading,
          headingTo: runway.heading,
          recoilStart: -1e9,
          lift,
          type: g.type,
          phase: g.phase,
          x: retarget(undefined, p0.at.x, now, 0),
          y: retarget(undefined, p0.at.y, now, 0),
          h: retarget(undefined, p0.lift, now, 0),
          track,
          zone,
          zoneRing,
          zoneMat,
          ringMat,
          zoneColor,
        };
        groups.set(g.id, entry);
        paintZone(entry, selectedGroup === g.id);
      } else if (isNew) {
        entry.track = nextTrack(runway, entry.track, entry.phase, g);
        const p = pose(entry.track);
        entry.phase = g.phase;
        entry.x = retarget(entry.x, p.at.x, now, duration);
        entry.y = retarget(entry.y, p.at.y, now, duration);
        entry.h = retarget(entry.h, p.lift, now, duration);
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
        groupColor: (id) => groupColors.get(id),
        shotKind: (group, enemy, damage) => {
          const g = groups.get(group);
          const e = enemies.get(enemy);
          const weapon = g && e && shotWeapon(content.groups[g.type]?.weapons ?? [], e.tags, damage);
          return weapon ? shotKindOf(weapon) : undefined;
        },
        enemySize: (id) => enemies.get(id)?.blast,
      });
      for (const spec of trimEffects(plan.effects, MAX_EFFECTS - live.length)) spawnEffect(spec, now);
      for (const id of plan.fired) {
        const g = groups.get(id);
        if (g) g.recoilStart = now;
      }
      for (const id of plan.hit) {
        const e = enemies.get(id);
        if (e) e.hitStart = now;
      }
      for (const id of plan.killed) {
        const e = enemies.get(id);
        if (!e) continue;
        const p = enemyWorld(e, now);
        e.mesh.position.set(p.x, p.y, p.z);
        dying.push({ mesh: e.mesh, scale: e.scale, start: now });
        removeBar(e.bar);
        enemies.delete(id);
      }
    }
    lastTick = state.tick;

    linkSpecs = attackLinks(state).map((l) => ({
      ...l,
      color: new Color(groupColors.get(l.group) ?? EFFECT_COLORS.tracer),
    }));
    const active = new Set(linkSpecs.map((l) => l.group));
    for (const [id, link] of links)
      if (!active.has(id)) {
        dynamic.remove(link.mesh);
        link.mat.dispose();
        links.delete(id);
      }
    for (const l of linkSpecs) {
      let link = links.get(l.group);
      if (!link) {
        const mat = new MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0.55, depthWrite: false });
        link = { mesh: new Mesh(tracerGeo, mat), mat };
        dynamic.add(link.mesh);
        links.set(l.group, link);
      }
      link.mat.color.copy(l.color);
    }

    // Зоны аур: круги появляются, пока владелец патрулирует, и исчезают вместе с его патрулём.
    const zones = new Map(auraZones({ content, state }).map((z) => [z.key, z]));
    for (const [key, a] of auraMeshes)
      if (!zones.has(key)) {
        dynamic.remove(a.disc.mesh, ...a.waves.map((w) => w.mesh));
        a.disc.mat.dispose();
        for (const w of a.waves) w.mat.dispose();
        auraMeshes.delete(key);
      }
    for (const [key, z] of zones) {
      let a = auraMeshes.get(key);
      if (!a) {
        const color = new Color(groupColors.get(z.group) ?? 0xffffff).lerp(new Color(0xffffff), 0.35);
        const make = (geo: BufferGeometry) => {
          const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
          const mesh = new Mesh(geo, mat);
          mesh.renderOrder = 2;
          const w = cellToWorld(z.at, size, AURA_Y);
          mesh.position.set(w.x, w.y, w.z);
          dynamic.add(mesh);
          return { mesh, mat };
        };
        a = { zone: z, waves: [make(waveGeo), make(waveGeo)], disc: make(zoneDiscGeo) };
        auraMeshes.set(key, a);
      } else {
        a.zone = z;
        // Зону могли перенести: круг следует за центром.
        const w = cellToWorld(z.at, size, AURA_Y);
        for (const m of [a.disc, ...a.waves]) m.mesh.position.set(w.x, w.y, w.z);
      }
    }

    for (const [id, entry] of enemies)
      if (!seenEnemies.has(id)) {
        dynamic.remove(entry.mesh);
        removeBar(entry.bar);
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
    for (const l of links.values()) l.mat.dispose();
    env.dispose();
    labelLayer.remove();
    baseLayer.remove();
    planeGeo.dispose();
    warnRingGeo.dispose();
    warnMat.dispose();
    routeGeo.dispose();
    for (const r of routeMeshes) (r.mesh.material as Material).dispose();
    tracerGeo.dispose();
    burstGeo.dispose();
    fxRingGeo.dispose();
    fxBoxGeo.dispose();
    waveGeo.dispose();
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
    if (lastState) paintMarks(lastState);
    draw();
  };

  const setWarning = (points: readonly { at: Vec2; label: string }[]) => {
    const key = JSON.stringify(points);
    if (key === warnKey) return;
    warnKey = key;
    for (const r of warnRings) dynamic.remove(r);
    labelLayer.replaceChildren();
    warnRings = points.map((p) => {
      const ring = new Mesh(warnRingGeo, warnMat);
      const w = cellToWorld(p.at, size, 0.12);
      ring.position.set(w.x, w.y, w.z);
      ring.renderOrder = 2;
      dynamic.add(ring);
      return ring;
    });
    warnLabels = points.filter((p) => p.label).map((p) => {
      const el = document.createElement('div');
      el.className = 'scene-label';
      el.textContent = p.label;
      labelLayer.appendChild(el);
      const w = cellToWorld(p.at, size, 0.4);
      return { el, world: new Vector3(w.x, w.y, w.z) };
    });
  };

  /** Доля размера боевой модели у «припаркованного» образца на базе. */
  const PARKED_SCALE = 0.8;
  /** Сколько типов было у каждой базы при прошлой отрисовке: рост — повод подсветить подпись. */
  let baseCounts: number[] = [];
  const setBases = (bases: readonly { at: Vec2; name: string; types: readonly string[] }[]) => {
    const key = JSON.stringify(bases);
    if (key === baseKey) return;
    baseKey = key;
    baseProps.clear();
    baseLayer.replaceChildren();
    const center = { x: (size.w - 1) / 2, y: (size.h - 1) / 2 };
    const before = baseCounts;
    baseCounts = bases.map((b) => b.types.length);
    baseLabels = bases.map((b, index) => {
      // Образцы стоят в ряд поперёк направления на центр карты, чуть позади ворот.
      const d = Math.hypot(center.x - b.at.x, center.y - b.at.y) || 1;
      const inward = { x: (center.x - b.at.x) / d, y: (center.y - b.at.y) / d };
      const side = { x: -inward.y, y: inward.x };
      b.types.forEach((type, i) => {
        const cfg = content.enemies[type];
        if (!cfg) return;
        const body = bodyMesh(cfg);
        const k = i - (b.types.length - 1) / 2;
        const at = { x: b.at.x + side.x * k * 0.8 + inward.x * 1.1, y: b.at.y + side.y * k * 0.8 + inward.y * 1.1 };
        const w = cellToWorld(at, size, 0.05);
        body.mesh.position.set(w.x, w.y, w.z);
        body.mesh.scale.setScalar(body.scale * PARKED_SCALE);
        body.mesh.rotation.y = headingOf(inward.x, inward.y) ?? 0;
        baseProps.add(body.mesh);
      });
      const el = document.createElement('div');
      // Подпись называет базу и её врагов; база, получившая новый тип, на время подсвечивается.
      const grown = before[index] !== undefined && b.types.length > before[index]!;
      el.className = grown ? 'scene-label scene-base is-grown' : 'scene-label scene-base';
      const title = document.createElement('div');
      title.textContent = b.name;
      const roster = document.createElement('div');
      roster.className = 'scene-base-types';
      roster.textContent = b.types.map((t) => content.enemies[t]?.name ?? t).join(' · ') || 'пока молчит';
      el.append(title, roster);
      baseLayer.appendChild(el);
      const w = cellToWorld(b.at, size, 1.4);
      return { el, world: new Vector3(w.x, w.y, w.z) };
    });
  };

  const routeDummy = new Object3D();
  const setRoutes = (routes: readonly { kind: TargetKind; points: readonly Vec2[] }[]) => {
    const key = JSON.stringify(routes);
    if (key === routeKey) return;
    routeKey = key;
    for (const { kind, mesh } of routeMeshes) {
      let n = 0;
      // Воздушный и наземный маршруты одной базы часто совпадают: точки воздушного сдвинуты на полшага.
      for (const r of routes.filter((x) => x.kind === kind))
        for (const p of routeDots(r.points, 0.5, kind === 'air' ? 1.05 : 0.8)) {
          if (n >= ROUTE_DOTS) break;
          const w = cellToWorld(p, size, 0.1);
          routeDummy.position.set(w.x, w.y, w.z);
          routeDummy.updateMatrix();
          mesh.setMatrixAt(n++, routeDummy.matrix);
        }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return { update, setSelectedGroup, setWarning, setBases, setRoutes, dispose };
}
