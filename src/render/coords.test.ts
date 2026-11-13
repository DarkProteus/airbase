import { OrthographicCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  cellToWorld,
  fitView,
  ISO_FORWARD,
  pickCell,
  screenToWorld,
  worldToCell,
  worldToScreen,
} from './coords';

const size = { w: 13, h: 11 };
const views = [fitView(size, 1280, 720), fitView(size, 390, 700), fitView(size, 1920, 400)];

describe('координаты sim -> мир -> экран', () => {
  it('cellToWorld и worldToCell взаимно обратны (в т.ч. дробные клетки)', () => {
    for (const c of [{ x: 0, y: 0 }, { x: 12, y: 10 }, { x: 3.25, y: 7.6 }]) {
      const back = worldToCell(cellToWorld(c, size, 2), size);
      expect(back.x).toBeCloseTo(c.x, 9);
      expect(back.y).toBeCloseTo(c.y, 9);
    }
  });

  it('карта центрирована в начале координат', () => {
    const a = cellToWorld({ x: 0, y: 0 }, size);
    const b = cellToWorld({ x: size.w - 1, y: size.h - 1 }, size);
    expect(a.x + b.x).toBeCloseTo(0);
    expect(a.z + b.z).toBeCloseTo(0);
  });

  it('screenToWorld обратно к worldToScreen для точек на земле', () => {
    for (const view of views)
      for (const c of [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: 12, y: 10 }, { x: 2.5, y: 8.1 }]) {
        const w = cellToWorld(c, size);
        const w2 = screenToWorld(worldToScreen(w, view), view);
        expect(w2.x).toBeCloseTo(w.x, 6);
        expect(w2.y).toBeCloseTo(0, 6);
        expect(w2.z).toBeCloseTo(w.z, 6);
      }
  });

  it('пикинг клетки по экранной точке её центра возвращает ту же клетку для каждой клетки', () => {
    for (const view of views)
      for (let y = 0; y < size.h; y++)
        for (let x = 0; x < size.w; x++) {
          const s = worldToScreen(cellToWorld({ x, y }, size), view);
          expect(pickCell(s, view, size)).toEqual({ x, y });
        }
  });

  it('пикинг вне карты даёт null', () => {
    const view = views[0]!;
    expect(pickCell({ x: 0, y: 0 }, view, size)).toBeNull();
  });

  it('вся карта помещается во вьюпорт', () => {
    for (const view of views)
      for (const c of [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 0, y: 10 }, { x: 12, y: 10 }]) {
        const s = worldToScreen(cellToWorld(c, size), view);
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(view.width);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(view.height);
      }
  });

  it('согласуется с ортографической камерой three, настроенной по тому же виду', () => {
    const view = views[0]!;
    const cam = new OrthographicCamera(
      view.centerU - view.width / 2 / view.zoom,
      view.centerU + view.width / 2 / view.zoom,
      view.centerV + view.height / 2 / view.zoom,
      view.centerV - view.height / 2 / view.zoom,
      0.1,
      100,
    );
    cam.position.set(-ISO_FORWARD.x * 30, -ISO_FORWARD.y * 30, -ISO_FORWARD.z * 30);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    for (const c of [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: 12, y: 10 }]) {
      const w = cellToWorld(c, size, 1);
      const ndc = new Vector3(w.x, w.y, w.z).project(cam);
      const s = worldToScreen(w, view);
      expect(((ndc.x + 1) / 2) * view.width).toBeCloseTo(s.x, 4);
      expect(((1 - ndc.y) / 2) * view.height).toBeCloseTo(s.y, 4);
    }
  });
});
