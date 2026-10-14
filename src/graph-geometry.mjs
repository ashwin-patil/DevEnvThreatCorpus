export const NODE_WIDTH = 250, NODE_HEIGHT = 126, ROUTE_GUTTER = 28;
const inside = (p, r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
export function segmentClear(a, b, rectangles) {
  return rectangles.every(r => a.x === b.x
    ? !(a.x > r.x && a.x < r.x + r.w && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.h)
    : !(a.y > r.y && a.y < r.y + r.h && Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.w));
}
export function graphLayout(graph) {
  const positions = {};
  let row = 0;
  for (const group of graph.groups ?? [{ nodeIds: graph.nodes.map(n => n.id) }]) {
    group.nodeIds.forEach((id, i) => { positions[id] = { x: 40 + (i % 3) * 330, y: 70 + (row + Math.floor(i / 3)) * 210 }; });
    row += Math.ceil(group.nodeIds.length / 3) + 1;
  }
  return positions;
}

// Orthogonal visibility-grid routing avoids every card, not just the endpoints.
// One router is shared by all edges during a paint; coordinates include gutters,
// boundary ports and outer lanes, so disconnected/reversed/loop edges need no inferred links.
export function graphRouter(positions) {
  const rectangles = Object.entries(positions).map(([id, p]) => ({ id, ...p, w: NODE_WIDTH, h: NODE_HEIGHT }));
  const ports = r => [
    { x: r.x + r.w, y: r.y + r.h / 2, dx: ROUTE_GUTTER, dy: 0 },
    { x: r.x, y: r.y + r.h / 2, dx: -ROUTE_GUTTER, dy: 0 },
    { x: r.x + r.w / 2, y: r.y, dx: 0, dy: -ROUTE_GUTTER },
    { x: r.x + r.w / 2, y: r.y + r.h, dx: 0, dy: ROUTE_GUTTER },
  ];
  const x = [...new Set(rectangles.flatMap(r => [r.x - ROUTE_GUTTER, r.x + r.w + ROUTE_GUTTER, r.x + r.w / 2]))].sort((a, b) => a - b);
  const y = [...new Set(rectangles.flatMap(r => [r.y - ROUTE_GUTTER, r.y + r.h + ROUTE_GUTTER, r.y + r.h / 2]))].sort((a, b) => a - b);
  const key = (xi, yi) => yi * x.length + xi;
  const point = k => ({ x: x[k % x.length], y: y[Math.floor(k / x.length)] });
  const index = p => key(x.indexOf(p.x), y.indexOf(p.y));
  const neighbors = new Map();
  const labelBoxes = [];
  for (let yi = 0; yi < y.length; yi++) for (let xi = 0; xi < x.length; xi++) {
    const k = key(xi, yi), p = point(k); if (rectangles.some(r => inside(p, r))) continue;
    const adjacent = [];
    for (const [nx, ny] of [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]]) {
      if (nx < 0 || nx >= x.length || ny < 0 || ny >= y.length) continue;
      const q = { x: x[nx], y: y[ny] };
      if (!rectangles.some(r => inside(q, r)) && segmentClear(p, q, rectangles)) adjacent.push(key(nx, ny));
    }
    neighbors.set(k, adjacent);
  }
  return (edge, ordinal = 0) => {
    const from = rectangles.find(r => r.id === edge.from), to = rectangles.find(r => r.id === edge.to);
    if (!from || !to) return null;
    const startPorts = ports(from), endPorts = ports(to);
    const distance = new Map(), previous = new Map(), roots = new Map(), queue = [];
    const push = (k, cost) => {
      queue.push({ k, cost }); let i = queue.length - 1;
      while (i) { const parent = (i - 1) >> 1; if (queue[parent].cost <= cost) break; [queue[i], queue[parent]] = [queue[parent], queue[i]]; i = parent; }
    };
    const pop = () => {
      const first = queue[0], last = queue.pop();
      if (queue.length) { queue[0] = last; let i = 0;
        while (true) { let j = i * 2 + 1; if (j >= queue.length) break;
          if (j + 1 < queue.length && queue[j + 1].cost < queue[j].cost) j++;
          if (queue[i].cost <= queue[j].cost) break; [queue[i], queue[j]] = [queue[j], queue[i]]; i = j; } }
      return first;
    };
    // Self-loops use distinct ports; identical endpoints must not produce a zero-length edge.
    const self = from.id === to.id;
    startPorts.forEach((p, i) => {
      if (self && i !== 0) return;
      const q = { x: p.x + p.dx, y: p.y + p.dy }, k = index(q);
      if (!neighbors.has(k) || !segmentClear(p, q, rectangles)) return;
      distance.set(k, ROUTE_GUTTER); roots.set(k, p); push(k, ROUTE_GUTTER);
    });
    const targets = new Map(endPorts.filter((p, i) => !self || i === 2).map(p => [index({ x: p.x + p.dx, y: p.y + p.dy }), p])
      .filter(([k, p]) => neighbors.has(k) && segmentClear(point(k), p, rectangles)));
    let found;
    while (queue.length) {
      const { k, cost } = pop(); if (distance.get(k) !== cost) continue;
      if (targets.has(k)) { found = k; break; }
      for (const next of neighbors.get(k) ?? []) {
        const a = point(k), b = point(next), d = cost + Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (d >= (distance.get(next) ?? Infinity)) continue;
        distance.set(next, d); previous.set(next, k); roots.set(next, roots.get(k)); push(next, d);
      }
    }
    if (found == null) return null;
    const steps = [targets.get(found)], end = found;
    for (let k = end; k != null; k = previous.get(k)) steps.unshift(point(k));
    steps.unshift(roots.get(found));
    // Remove collinear grid subdivisions before rendering and placing the label.
    const points = steps.filter((p, i) => !i || i === steps.length - 1
      || !((steps[i - 1].x === p.x && p.x === steps[i + 1].x) || (steps[i - 1].y === p.y && p.y === steps[i + 1].y)));
    const segments = points.slice(1).map((b, i) => ({ a: points[i], b, length: Math.abs(b.x - points[i].x) + Math.abs(b.y - points[i].y) }));
    // A full label-sized box must be outside all cards. Outer lanes handle dense branches.
    const labelWidth = 132, labelHeight = 24;
    const candidates = segments.sort((a, b) => b.length - a.length).flatMap(({ a, b }) => [
      { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 14 },
      { x: (a.x + b.x) / 2 + 80, y: (a.y + b.y) / 2 },
    ]);
    candidates.push(...x.flatMap(xx => y.map(yy => ({ x: xx, y: yy - 14 }))));
    const label = candidates.find(p => [...rectangles, ...labelBoxes].every(r => p.x + labelWidth / 2 < r.x || p.x - labelWidth / 2 > r.x + r.w
      || p.y + 6 < r.y || p.y - labelHeight > r.y + r.h));
    if (label) labelBoxes.push({ x: label.x - labelWidth / 2, y: label.y - labelHeight, w: labelWidth, h: labelHeight + 6 });
    return { points, d: points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '), label,
      ordinal };
  };
}
