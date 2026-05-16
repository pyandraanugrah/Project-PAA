/**
 * script.js
 * Airport Pathfinder — Dijkstra Navigator
 *
 * Sections:
 *  1. Graph Data (Nodes + Adjacency List)
 *  2. Priority Queue (min-heap based)
 *  3. Dijkstra Algorithm
 *  4. Path Reconstruction
 *  5. Canvas Renderer
 *  6. Person Icon Overlay
 *  7. Animation Engine
 *  8. UI Helpers
 *  9. Event Listeners
 * 10. Initialization
 */

'use strict';

/* ============================================================
   1. GRAPH DATA
   rx, ry = relative [0..1] coordinates on the map image.
============================================================ */
let NODES = {
  A: { id: 'A', name: 'Terminal Utama (Bandara)', rx: 0.500, ry: 0.365 },
  B: { id: 'B', name: 'Gudang Cargo',             rx: 0.340, ry: 0.735 },
  C: { id: 'C', name: 'Area Tengah / Akses Jalan',rx: 0.505, ry: 0.540 },
  D: { id: 'D', name: 'Kantor BMKG',              rx: 0.755, ry: 0.230 },
  E: { id: 'E', name: 'Gedung Engku Puteri',      rx: 0.820, ry: 0.350 },
  F: { id: 'F', name: 'Airnav Tanjungpinang',     rx: 0.880, ry: 0.450 },
  G: { id: 'G', name: 'Area Parkir',              rx: 0.420, ry: 0.295 },
  H: { id: 'H', name: 'Pos Security',             rx: 0.355, ry: 0.250 },
  I: { id: 'I', name: 'Gerbang Masuk',            rx: 0.275, ry: 0.215 },
};

/**
 * Adjacency list — bidirectional.
 * Format: { nodeId: { neighborId: weight, ... }, ... }
 * Weights represent approximate distances in metres.
 */
const GRAPH = {
  A: { B: 450, C: 200, D: 340, E: 390, F: 440, G: 70  },
  B: { A: 450, C: 250 },
  C: { A: 200, B: 250 },
  D: { A: 340, E: 100 },
  E: { D: 100, F: 90,  A: 390 },
  F: { E: 90,  A: 440 },
  G: { H: 40,  A: 70  },
  H: { I: 50,  G: 40  },
  I: { H: 50  },
};

/* ============================================================
   RANDOM MAP LAYOUTS
   Preset posisi node agar map bisa berubah acak
============================================================ */

const MAP_LAYOUTS = [

  // LAYOUT 1 (default)
  {
    A:{ rx:0.500, ry:0.365 },
    B:{ rx:0.340, ry:0.735 },
    C:{ rx:0.505, ry:0.540 },
    D:{ rx:0.755, ry:0.230 },
    E:{ rx:0.820, ry:0.350 },
    F:{ rx:0.880, ry:0.450 },
    G:{ rx:0.420, ry:0.295 },
    H:{ rx:0.355, ry:0.250 },
    I:{ rx:0.275, ry:0.215 },
  },

  // LAYOUT 2
  {
    A:{ rx:0.470, ry:0.390 },
    B:{ rx:0.310, ry:0.700 },
    C:{ rx:0.480, ry:0.560 },
    D:{ rx:0.730, ry:0.260 },
    E:{ rx:0.790, ry:0.390 },
    F:{ rx:0.860, ry:0.490 },
    G:{ rx:0.390, ry:0.330 },
    H:{ rx:0.330, ry:0.280 },
    I:{ rx:0.250, ry:0.240 },
  },

  // LAYOUT 3
  {
    A:{ rx:0.530, ry:0.340 },
    B:{ rx:0.360, ry:0.760 },
    C:{ rx:0.530, ry:0.520 },
    D:{ rx:0.780, ry:0.210 },
    E:{ rx:0.850, ry:0.330 },
    F:{ rx:0.900, ry:0.430 },
    G:{ rx:0.450, ry:0.270 },
    H:{ rx:0.380, ry:0.220 },
    I:{ rx:0.300, ry:0.190 },
  }

];
/* ============================================================
   2. PRIORITY QUEUE (min-heap)
   Supports: enqueue(item, priority), dequeue(), isEmpty()
============================================================ */
class PriorityQueue {
  constructor() {
    this._heap = []; // each element: { item, priority }
  }

  /** Insert an item with the given numeric priority (lower = higher priority). */
  enqueue(item, priority) {
    this._heap.push({ item, priority });
    this._bubbleUp(this._heap.length - 1);
  }

  /** Remove and return the item with the lowest priority value. */
  dequeue() {
    if (this.isEmpty()) return null;
    const top = this._heap[0].item;
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  isEmpty() {
    return this._heap.length === 0;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._heap[parent].priority <= this._heap[i].priority) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._heap[l].priority < this._heap[smallest].priority) smallest = l;
      if (r < n && this._heap[r].priority < this._heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this._heap[smallest], this._heap[i]] = [this._heap[i], this._heap[smallest]];
      i = smallest;
    }
  }
}

/* ============================================================
   3. DIJKSTRA ALGORITHM
   Returns: { path, totalDist, dist, prev, steps }
============================================================ */
/**
 * Run Dijkstra on GRAPH from start to end.
 *
 * @param {Object} graph - adjacency list { node: { neighbor: weight } }
 * @param {string} start - starting node ID
 * @param {string} end   - destination node ID
 * @returns {{ path:string[], totalDist:number, dist:Object, prev:Object, steps:Array }}
 */
function dijkstra(graph, start, end) {
  const INF   = Infinity;
  const nodes = Object.keys(graph);

  // dist[n]  = shortest known distance from start to n
  const dist  = {};
  // prev[n]  = previous node on the shortest path to n
  const prev  = {};
  // visited  = set of nodes already finalised
  const visited = new Set();
  // steps    = array recording algorithm state at each expansion
  const steps = [];

  // Initialise
  for (const n of nodes) {
    dist[n] = INF;
    prev[n] = null;
  }
  dist[start] = 0;

  const pq = new PriorityQueue();
  pq.enqueue(start, 0);

  while (!pq.isEmpty()) {
    const current = pq.dequeue();

    // Skip if already finalised (stale entry in PQ)
    if (visited.has(current)) continue;
    visited.add(current);

    // Record step for visualisation
    steps.push({
      currentNode: current,
      distances:   { ...dist },
      visited:     new Set(visited),
    });

    if (current === end) break;

    // Relax each neighbour
    const neighbors = graph[current] || {};
    for (const [neighbor, weight] of Object.entries(neighbors)) {
      if (visited.has(neighbor)) continue;
      const newDist = dist[current] + weight;
      if (newDist < dist[neighbor]) {
        dist[neighbor] = newDist;
        prev[neighbor] = current;
        pq.enqueue(neighbor, newDist);
      }
    }
  }

  // Reconstruct path
  const path = getPath(prev, start, end);

  return {
    path,
    totalDist: dist[end] < INF ? dist[end] : Infinity,
    dist,
    prev,
    steps,
  };
}

/* ============================================================
   4. PATH RECONSTRUCTION
   Traces prev[] pointers from end back to start.
============================================================ */
/**
 * @param {Object} prev  - previous-node map from dijkstra()
 * @param {string} start - start node ID
 * @param {string} end   - end node ID
 * @returns {string[]} ordered array of node IDs, or [] if no path
 */
function getPath(prev, start, end) {
  const path = [];
  let current = end;

  while (current !== null) {
    path.unshift(current);
    current = prev[current];
  }

  // Validate that the reconstructed path actually starts at `start`
  if (path.length === 0 || path[0] !== start) return [];
  return path;
}

/* ============================================================
   5. CANVAS RENDERER
   Draws edges, nodes, path highlight.
============================================================ */
const canvas = document.getElementById('map-canvas');
const ctx    = canvas.getContext('2d');

/** Current application view state */
const viewState = {
  path:      [],   // shortest path node IDs
  startNode: null,
  endNode:   null,
  hoverNode: null,
};

/** Convert relative coords [0..1] to canvas pixel position */
function toPx(rx, ry) {
  return { x: rx * canvas.width, y: ry * canvas.height };
}

/** Resize canvas to match its DOM container */
function resizeCanvas() {
  const frame = document.getElementById('map-frame');
  canvas.width  = frame.clientWidth;
  canvas.height = frame.clientHeight;
  renderAll();
}

/** Build a Set of 'A-B' keys for edges on the shortest path */
function buildPathEdgeSet(path) {
  const s = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    s.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  return s;
}

/** Draw all graph edges (grey for normal, red for path) */
function drawEdges(pathEdgeSet) {
  for (const [nid, neighbors] of Object.entries(GRAPH)) {
    for (const [neighborId, weight] of Object.entries(neighbors)) {
      // Draw each edge only once
      if (nid >= neighborId) continue;

      const a = toPx(NODES[nid].rx, NODES[nid].ry);
      const b = toPx(NODES[neighborId].rx, NODES[neighborId].ry);
      const key = nid < neighborId ? `${nid}-${neighborId}` : `${neighborId}-${nid}`;
      const isPath = pathEdgeSet.has(key);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      if (isPath) {
        ctx.strokeStyle = '#ff3c3c';
        ctx.lineWidth   = 3;
        ctx.shadowColor = 'rgba(255,60,60,.5)';
        ctx.shadowBlur  = 7;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth   = 1.2;
        ctx.shadowBlur  = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Weight label on non-path edges
      if (!isPath) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 10px Rajdhani, sans-serif';
        ctx.textAlign = 'center';

        // outline hitam
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth = 4;

        // glow
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 8;

        ctx.strokeText(`${weight}m`, mx, my - 4);
        ctx.fillText(`${weight}m`, mx, my - 4);

        ctx.shadowBlur = 0;
      }
    }
  }
}

/**
 * Draw the animated segment of the path up to segFrac.
 * segFrac is a float: integer part = completed segments, fractional = progress in current.
 */
function drawAnimatedPath(path, segFrac) {
  if (path.length < 2) return;

  const totalSeg = path.length - 1;
  const fullSegs = Math.floor(segFrac);
  const partial  = segFrac - fullSegs;

  ctx.strokeStyle = '#ff3c3c';
  ctx.lineWidth   = 3.5;
  ctx.shadowColor = 'rgba(255,60,60,.7)';
  ctx.shadowBlur  = 10;

  // Draw fully-completed segments
  for (let i = 0; i < fullSegs && i < totalSeg; i++) {
    const a = toPx(NODES[path[i]].rx,     NODES[path[i]].ry);
    const b = toPx(NODES[path[i+1]].rx,   NODES[path[i+1]].ry);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Draw partial last segment
  if (fullSegs < totalSeg && partial > 0) {
    const a  = toPx(NODES[path[fullSegs]].rx,   NODES[path[fullSegs]].ry);
    const b  = toPx(NODES[path[fullSegs+1]].rx, NODES[path[fullSegs+1]].ry);
    const ex = a.x + (b.x - a.x) * partial;
    const ey = a.y + (b.y - a.y) * partial;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
}

/**
 * Draw all nodes with appropriate colours:
 *  - start node  → green
 *  - end node    → red
 *  - on path & visited (by animation) → yellow
 *  - on path, not yet visited → cyan
 *  - other → dim blue
 */
function drawNodes(path, visitedUpToIndex) {
  for (const [nid, node] of Object.entries(NODES)) {
    const pos     = toPx(node.rx, node.ry);
    const isStart = nid === viewState.startNode;
    const isEnd   = nid === viewState.endNode;
    const pidx    = path.indexOf(nid);
    const onPath  = pidx >= 0;
    const visited = onPath && pidx <= visitedUpToIndex;
    const hover   = nid === viewState.hoverNode;
    const r       = hover ? 11 : 8;

    // Choose fill colour
    let fill = '#ffffff';
    let glow = null;

    if      (isStart)  { fill = '#27ae60'; glow = '#27ae60'; }
    else if (isEnd)    { fill = '#ff3c3c'; glow = '#ff3c3c'; }
    else if (visited)  { fill = '#f5c842'; glow = '#f5c842'; }
    else if (onPath)   { fill = '#00c8f0'; glow = '#00c8f0'; }

    // Glow halo
    if (glow) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(glow, 0.18);
      ctx.fill();
    }

    // Circle body
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.shadowColor = glow || 'transparent';
    ctx.shadowBlur  = glow ? (hover ? 18 : 10) : 0;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Outline
    ctx.strokeStyle = hover ? '#ffffff' : 'rgba(255,255,255,.4)';
    ctx.lineWidth   = hover ? 2 : 1;
    ctx.stroke();

    // Node ID label (letter)
    ctx.fillStyle    = '#000000';
    ctx.font         = 'bold 11px "Bebas Neue", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nid, pos.x, pos.y);

    // Short name label below node
    ctx.fillStyle    = 'rgba(220,235,255,.9)';
    ctx.font         = 'bold 9px Rajdhani, sans-serif';
    ctx.textBaseline = 'top';
    // text shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 3;
    ctx.fillText(node.name.split(' ')[0], pos.x, pos.y + r + 3);
    ctx.shadowBlur  = 0;
    ctx.textBaseline = 'alphabetic';
  }
}

/* ============================================================
   BACKGROUND & ROAD RENDERER
   Draws a procedural airport background and road network
   directly onto the canvas — no external image needed.
============================================================ */

/**
 * Draw a procedural satellite-style airport background.
 * Layers: sky/ground base → terrain patches → runway → apron → buildings
 */
function drawBackground() {
  const W = canvas.width;
  const H = canvas.height;

  /* ── 1. Base ground fill ── */
  const groundGrad = ctx.createLinearGradient(0, 0, W, H);
  groundGrad.addColorStop(0,   '#4a6741');
  groundGrad.addColorStop(0.35,'#5c7a52');
  groundGrad.addColorStop(0.6, '#3d5c35');
  groundGrad.addColorStop(1,   '#2e4a28');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 0, W, H);

  /* ── 2. Terrain texture dots (subtle noise) ── */
  ctx.save();
  const rng = mulberry32(42); // deterministic "random"
  for (let i = 0; i < 600; i++) {
    const tx = rng() * W;
    const ty = rng() * H;
    const tr = rng() * 3 + 0.5;
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rng() > 0.5 ? 80 : 30},${rng() > 0.5 ? 100 : 60},${rng() > 0.5 ? 50 : 20},${rng() * 0.18 + 0.04})`;
    ctx.fill();
  }
  ctx.restore();

  /* ── 3. Dense vegetation patches (top-left corner & edges) ── */
  // Top-left forest area
  drawPatch(ctx, [
    {x:0,y:0},{x:W*0.22,y:0},{x:W*0.28,y:H*0.15},{x:W*0.18,y:H*0.45},
    {x:W*0.05,y:H*0.55},{x:0,y:H*0.55}
  ], '#2d5c24', '#3a7030', 0.92);

  // Scattered tree clusters on that patch
  const rng2 = mulberry32(99);
  for (let i = 0; i < 120; i++) {
    const bx = rng2() * W * 0.28;
    const by = rng2() * H * 0.55;
    if (bx < W * 0.28 - by * 0.35) {
      drawTree(ctx, bx, by, rng2() * 5 + 3);
    }
  }

  /* ── 4. Main RUNWAY (diagonal strip) ── */
  // Runway: from top-right area diagonally to lower-left area
  // Matches visual layout of Raja Haji Fisabilillah airport
  //drawRunway(ctx, W, H);

  /* ── 5. Taxiway ── */
  //drawTaxiway(ctx, W, H);

  /* ── 6. Apron / terminal area ── */
  //drawApron(ctx, W, H);

  /* ── 7. Terminal building silhouette ── */
  drawBuildings(ctx, W, H);

  /* ── 8. Perimeter fence line ── */
  drawFence(ctx, W, H);

  /* ── 9. Subtle vignette ── */
  const vig = ctx.createRadialGradient(W/2,H/2, H*0.3, W/2,H/2, H*0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** Simple deterministic pseudo-random (Mulberry32) */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Draw a filled polygon with a radial highlight */
function drawPatch(ctx, pts, col1, col2, alpha) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = col1;
  ctx.fill();
  ctx.restore();
}

/** Draw a small tree circle */
function drawTree(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.1, x, y, r);
  g.addColorStop(0, '#5aad3f');
  g.addColorStop(1, '#1e4a14');
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.restore();
}

/** Draw the main runway diagonal strip */
function drawRunway(ctx, W, H) {
  ctx.save();

  // Runway footprint — diagonal from ~top-right to bottom-left
  const rx1 = W * 0.98, ry1 = H * 0.08;
  const rx2 = W * 0.25, ry2 = H * 0.92;
  const halfW = W * 0.045;

  // Perpendicular offset vector
  const dx = rx2 - rx1, dy = ry2 - ry1;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;

  // Runway concrete base
  ctx.beginPath();
  ctx.moveTo(rx1 + nx*halfW, ry1 + ny*halfW);
  ctx.lineTo(rx2 + nx*halfW, ry2 + ny*halfW);
  ctx.lineTo(rx2 - nx*halfW, ry2 - ny*halfW);
  ctx.lineTo(rx1 - nx*halfW, ry1 - ny*halfW);
  ctx.closePath();
  ctx.fillStyle = '#5a5a5c';
  ctx.fill();

  // Runway surface gradient (worn asphalt look)
  const rGrad = ctx.createLinearGradient(rx1,ry1,rx2,ry2);
  rGrad.addColorStop(0,   'rgba(80,80,85,0.9)');
  rGrad.addColorStop(0.5, 'rgba(65,65,70,0.95)');
  rGrad.addColorStop(1,   'rgba(80,80,85,0.9)');
  ctx.beginPath();
  ctx.moveTo(rx1 + nx*(halfW-2), ry1 + ny*(halfW-2));
  ctx.lineTo(rx2 + nx*(halfW-2), ry2 + ny*(halfW-2));
  ctx.lineTo(rx2 - nx*(halfW-2), ry2 - ny*(halfW-2));
  ctx.lineTo(rx1 - nx*(halfW-2), ry1 - ny*(halfW-2));
  ctx.closePath();
  ctx.fillStyle = rGrad;
  ctx.fill();

  // Centre dashed line
  ctx.setLineDash([W*0.025, W*0.015]);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = Math.max(1.5, W * 0.002);
  ctx.beginPath();
  ctx.moveTo(rx1, ry1);
  ctx.lineTo(rx2, ry2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Runway edge lines
  ctx.strokeStyle = 'rgba(255,255,220,0.35)';
  ctx.lineWidth = 1;
  for (const side of [halfW * 0.85, -halfW * 0.85]) {
    ctx.beginPath();
    ctx.moveTo(rx1 + nx*side, ry1 + ny*side);
    ctx.lineTo(rx2 + nx*side, ry2 + ny*side);
    ctx.stroke();
  }

  // Threshold markings at each end
  drawThreshold(ctx, rx1, ry1, nx, ny, halfW);
  drawThreshold(ctx, rx2, ry2, nx, ny, halfW);

  ctx.restore();
}

/** Draw runway threshold bars */
function drawThreshold(ctx, cx, cy, nx, ny, hw) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1.5, hw * 0.06);
  const barCount = 6;
  const spacing  = (hw * 1.6) / barCount;
  for (let b = -barCount/2; b < barCount/2; b++) {
    const ox = nx * (b * spacing + spacing/2);
    const oy = ny * (b * spacing + spacing/2);
    ctx.beginPath();
    ctx.moveTo(cx + ox - ny * hw*0.08, cy + oy + nx * hw*0.08);
    ctx.lineTo(cx + ox + ny * hw*0.08, cy + oy - nx * hw*0.08);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw taxiway connecting runway to apron */
function drawTaxiway(ctx, W, H) {
  ctx.save();
  // Main taxiway parallel to runway, offset toward terminal
  ctx.lineWidth = W * 0.022;
  ctx.strokeStyle = '#4e4e52';
  ctx.lineCap = 'round';

  // Taxiway alpha: from mid-runway toward terminal building
  ctx.beginPath();
  ctx.moveTo(W * 0.72, H * 0.28);
  ctx.quadraticCurveTo(W * 0.62, H * 0.32, W * 0.57, H * 0.40);
  ctx.stroke();

  // Taxiway centre line (yellow)
  ctx.lineWidth = Math.max(1, W * 0.002);
  ctx.strokeStyle = 'rgba(230,200,50,0.6)';
  ctx.setLineDash([W*0.015, W*0.01]);
  ctx.beginPath();
  ctx.moveTo(W * 0.72, H * 0.28);
  ctx.quadraticCurveTo(W * 0.62, H * 0.32, W * 0.57, H * 0.40);
  ctx.stroke();
  ctx.setLineDash([]);

  // Short connector
  ctx.setLineDash([]);
  ctx.lineWidth = W * 0.018;
  ctx.strokeStyle = '#4e4e52';
  ctx.beginPath();
  ctx.moveTo(W * 0.57, H * 0.40);
  ctx.lineTo(W * 0.53, H * 0.45);
  ctx.stroke();

  ctx.restore();
}

/** Draw the apron (aircraft parking area) */
function drawApron(ctx, W, H) {
  ctx.save();

  // Apron concrete pad
  ctx.beginPath();
  ctx.roundRect(W * 0.40, H * 0.28, W * 0.22, H * 0.30, 4);
  ctx.fillStyle = '#7a7a80';
  ctx.globalAlpha = 0.75;
  ctx.fill();

  // Apron surface detail lines (parking bays)
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const x = W * 0.42 + i * W * 0.048;
    ctx.beginPath();
    ctx.moveTo(x, H * 0.30);
    ctx.lineTo(x, H * 0.54);
    ctx.stroke();
  }

  // Aircraft silhouettes on apron
  ctx.globalAlpha = 0.6;
  

  ctx.restore();
}

/** Draw a simple aircraft silhouette top-down */
function drawAircraft(ctx, cx, cy, size) {
  ctx.save();
  ctx.fillStyle = '#c8c8cc';
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;

  // Fuselage
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.1, size * 0.5, -Math.PI*0.18, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // Wings
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.05, size * 0.45, size * 0.07, -Math.PI*0.18, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.ellipse(cx - size*0.02, cy + size*0.4, size*0.18, size*0.04, -Math.PI*0.18, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  ctx.restore();
}

/** Draw terminal & support buildings */
function drawBuildings(ctx, W, H) {
  ctx.save();

  // Terminal building
  const bx = W * 0.41, by = H * 0.27;
  const bw = W * 0.14, bh = H * 0.12;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(bx + 4, by + 4, bw, bh);

  // Base
  ctx.fillStyle = '#a0a8b0';
  ctx.fillRect(bx, by, bw, bh);

  // Roof detail
  const roofGrad = ctx.createLinearGradient(bx, by, bx+bw, by+bh);
  roofGrad.addColorStop(0, '#b8c0c8');
  roofGrad.addColorStop(1, '#787e85');
  ctx.fillStyle = roofGrad;
  ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);

  // Windows strip
  ctx.fillStyle = 'rgba(160,200,240,0.6)';
  ctx.fillRect(bx + 6, by + bh*0.25, bw - 12, bh * 0.25);

  // BMKG building (node D area)
  drawSmallBuilding(ctx, W * 0.74, H * 0.18, W * 0.06, H * 0.10, '#9aa0a8');

  // Airnav building (node F area)
  drawSmallBuilding(ctx, W * 0.86, H * 0.40, W * 0.05, H * 0.08, '#8a9098');

  // Engku Puteri building (node E area)
  drawSmallBuilding(ctx, W * 0.80, H * 0.31, W * 0.055, H * 0.09, '#929aa2');

  // Cargo building
  drawSmallBuilding(ctx, W * 0.30, H * 0.68, W * 0.08, H * 0.10, '#88888e');

  ctx.restore();
}

function drawSmallBuilding(ctx, x, y, w, h, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 3, y + 3, w, h);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x+w, y+h);
  g.addColorStop(0, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** Draw airport perimeter fence */
function drawFence(ctx, W, H) {
  ctx.save();
  ctx.strokeStyle = 'rgba(180,190,200,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  // Rough perimeter around airfield
  ctx.moveTo(W * 0.22, H * 0.05);
  ctx.lineTo(W * 0.98, H * 0.05);
  ctx.lineTo(W * 0.98, H * 0.90);
  ctx.lineTo(W * 0.22, H * 0.90);
  ctx.lineTo(W * 0.22, H * 0.05);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* ============================================================
   ROAD NETWORK RENDERER
   Draws roads that connect the graph nodes visually,
   as actual road segments with lanes and markings.
============================================================ */

/**
 * Draw the airport road network before the graph edges.
 * Roads follow the same topology as GRAPH edges.
 */
function drawRoads() {
  const W = canvas.width;
  const H = canvas.height;

  // Road segments to draw: same as GRAPH edges but only once each
  const drawn = new Set();
  for (const [nid, neighbors] of Object.entries(GRAPH)) {
    for (const [neighborId] of Object.entries(neighbors)) {
      if (nid >= neighborId) continue;
      const key = `${nid}-${neighborId}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      const a = toPx(NODES[nid].rx, NODES[nid].ry);
      const b = toPx(NODES[neighborId].rx, NODES[neighborId].ry);

      drawRoadSegment(ctx, a.x, a.y, b.x, b.y, W);
    }
  }
}

/** Draw a single road segment with asphalt, kerbs, and centre line */
function drawRoadSegment(ctx, x1, y1, x2, y2, W) {
  const roadWidth = Math.max(6, W * 0.012);

  ctx.save();

  // Road shadow/depth
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = roadWidth + 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Road surface (asphalt)
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = roadWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Road surface highlight (worn centre)
  ctx.strokeStyle = 'rgba(60,60,65,0.7)';
  ctx.lineWidth = roadWidth * 0.55;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Kerb/edge lines
  ctx.strokeStyle = 'rgba(200,200,180,0.3)';
  ctx.lineWidth = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    const nx = -dy / len, ny = dx / len;
    const off = roadWidth * 0.52;
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(x1 + nx*off*s, y1 + ny*off*s);
      ctx.lineTo(x2 + nx*off*s, y2 + ny*off*s);
      ctx.stroke();
    }
  }

  // Centre dashed line
  ctx.strokeStyle = 'rgba(255,220,50,0.45)';
  ctx.lineWidth = Math.max(0.8, W * 0.0015);
  ctx.setLineDash([W * 0.018, W * 0.012]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

/** Master render: clear → background → roads → edges → path → nodes */
function renderAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Procedural airport background
  drawBackground();

  // 2. Road network (visual roads along graph edges)
  drawRoads();

  const path         = viewState.path;
  const pathEdgeSet  = buildPathEdgeSet(path);

  // 3. Draw graph edges (with path highlight)
  drawEdges(pathEdgeSet);

  // 4. Draw path line
  if (animState.active || animState.paused || animState.done) {
    drawAnimatedPath(path, animState.segFrac);
  } else if (path.length > 1) {
    // Show full path before animation starts
    drawAnimatedPath(path, path.length);
  }

  // 5. Draw nodes
  const visitedIdx = (animState.active || animState.paused || animState.done)
    ? Math.floor(animState.segFrac)
    : (path.length ? 999 : 0);
  drawNodes(path, visitedIdx);
}

/* ============================================================
   6. PERSON ICON OVERLAY
   Uses an absolutely-positioned DOM element over the canvas.
============================================================ */
const personEl = document.getElementById('person-icon');

/**
 * Move the person icon to canvas-relative pixel position (px, py).
 * The icon is offset so its "feet" sit on the target point.
 * @param {number} px - canvas pixel x
 * @param {number} py - canvas pixel y
 * @param {number} angleDeg - rotation in degrees (direction of travel)
 */
function movePerson(px, py, angleDeg) {
  const frame = document.getElementById('map-frame');
  const rect  = canvas.getBoundingClientRect();
  const fRect = frame.getBoundingClientRect();

  // Convert canvas coords to frame-relative coords
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  const fx = px / scaleX;
  const fy = py / scaleY;

  // Position: feet at (fx, fy), icon centred horizontally
  personEl.style.left = `${fx}px`;
  personEl.style.top  = `${fy}px`;
  personEl.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
}

function showPerson()  { personEl.style.display = 'block'; }
function hidePerson()  { personEl.style.display = 'none';  }
function setPulse(on)  { personEl.classList.toggle('moving', on); }

/* ============================================================
   7. ANIMATION ENGINE
   Moves the person icon along the shortest path.
============================================================ */

/** Animation state object */
const animState = {
  active:    false,
  paused:    false,
  done:      false,
  segFrac:   0,       // float: completed segments + fraction
  travelDist:0,       // metres covered so far
  totalDist: 0,       // total path distance
  lastTs:    null,    // last animation frame timestamp
  raf:       null,    // requestAnimationFrame handle
  speedMult: 4,       // metres/sec factor
  angle:     0,       // current heading in degrees
};

/** Return the edge weight for segment i of path */
function getSegWeight(path, i) {
  if (i >= path.length - 1) return 0;
  return GRAPH[path[i]][path[i + 1]] || 1;
}

/** Start or resume animation */
function startAnimation() {
  const path = viewState.path;
  if (!path.length) return;

  if (animState.done) {
    animState.segFrac    = 0;
    animState.travelDist = 0;
    animState.done       = false;
  }

  animState.active = true;
  animState.paused = false;
  animState.lastTs = null;

  showPerson();
  setPulse(true);
  setStatus('Pengguna bergerak menuju tujuan...', true);

  cancelAnimationFrame(animState.raf);
  animState.raf = requestAnimationFrame(animationLoop);
}

/** Pause animation */
function pauseAnimation() {
  animState.active = false;
  animState.paused = true;
  cancelAnimationFrame(animState.raf);
  setPulse(false);
  setStatus('Animasi dijeda.', false);
}

/** Reset animation to initial state */
function resetAnimation() {
  animState.active    = false;
  animState.paused    = false;
  animState.done      = false;
  animState.segFrac   = 0;
  animState.travelDist = 0;
  cancelAnimationFrame(animState.raf);
  setPulse(false);
  hidePerson();

  document.getElementById('res-travel').textContent = '0';
  document.getElementById('prog-bar').style.width   = '0%';

  renderAll();
}

/** Per-frame animation callback */
function animationLoop(timestamp) {
  if (!animState.active) return;

  // Initialise timestamp on first frame
  if (animState.lastTs === null) animState.lastTs = timestamp;
  const dt = timestamp - animState.lastTs;
  animState.lastTs = timestamp;

  const path     = viewState.path;
  const totalSeg = path.length - 1;

  if (totalSeg <= 0) { finishAnimation(); return; }

  // Advance segFrac based on speed (metres per second)
  const mps    = animState.speedMult * 60;
  const si     = Math.min(Math.floor(animState.segFrac), totalSeg - 1);
  const segW   = getSegWeight(path, si);
  animState.segFrac += (mps * dt * 0.001) / Math.max(segW, 1);

  if (animState.segFrac >= totalSeg) {
    animState.segFrac = totalSeg;
    finishAnimation();
    return;
  }

  // Calculate interpolated person position
  const si2 = Math.min(Math.floor(animState.segFrac), totalSeg - 1);
  const sf   = animState.segFrac - si2;

  const nodeA = NODES[path[si2]];
  const nodeB = NODES[path[Math.min(si2 + 1, totalSeg)]];

  const ax = nodeA.rx * canvas.width;
  const ay = nodeA.ry * canvas.height;
  const bx = nodeB.rx * canvas.width;
  const by = nodeB.ry * canvas.height;

  const vx = ax + (bx - ax) * sf;
  const vy = ay + (by - ay) * sf;

  // Rotation: angle towards the next node
  const angleRad = Math.atan2(by - ay, bx - ax);
  const angleDeg = (angleRad * 180 / Math.PI); // offset so "up" = forward
  animState.angle = angleDeg;

  // Update person DOM element
  movePerson(vx, vy, angleDeg);

  // Calculate travel distance
  let travelled = 0;
  for (let i = 0; i < si2; i++) travelled += getSegWeight(path, i);
  travelled += getSegWeight(path, si2) * sf;
  animState.travelDist = travelled;

  // Update distance UI
  document.getElementById('res-travel').textContent = Math.round(travelled);
  const pct = animState.totalDist > 0
    ? Math.min(100, (travelled / animState.totalDist) * 100)
    : 0;
  document.getElementById('prog-bar').style.width = `${pct}%`;

  renderAll();
  animState.raf = requestAnimationFrame(animationLoop);
}

/** Called when animation reaches the destination */
function finishAnimation() {
  animState.active = false;
  animState.done   = true;
  cancelAnimationFrame(animState.raf);
  setPulse(false);

  // Snap person to end node
  const path  = viewState.path;
  const last  = NODES[path[path.length - 1]];
  const endX  = last.rx * canvas.width;
  const endY  = last.ry * canvas.height;
  movePerson(endX, endY, 0);

  document.getElementById('res-travel').textContent = animState.totalDist;
  document.getElementById('prog-bar').style.width   = '100%';
  setStatus('Tiba di tujuan! 🎯', false);
  renderAll();
}

/* ============================================================
   8. UI HELPERS
============================================================ */

/** Update the status strip at the bottom of the map */
function setStatus(text, blinking) {
  document.getElementById('stext').textContent = text;
  document.getElementById('sdot').classList.toggle('on', blinking);
}

/** Populate both dropdown selects with node IDs and names */
function populateSelects() {
  const selStart = document.getElementById('sel-start');
  const selEnd   = document.getElementById('sel-end');

  for (const [id, node] of Object.entries(NODES)) {
    const label = `${id} — ${node.name.substring(0, 22)}`;
    selStart.add(new Option(label, id));
    selEnd.add(new Option(label, id));
  }
}

/** Convert a #rrggbb hex colour to rgba() string */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ============================================================
   RANDOMIZE MAP LAYOUT
============================================================ */

function randomizeMapLayout() {

  const layout =
    MAP_LAYOUTS[Math.floor(Math.random() * MAP_LAYOUTS.length)];

    console.log("MAP RANDOMIZED");
    console.log(layout);
  // update posisi node TANPA mengubah struktur node
  for (const [id, pos] of Object.entries(layout)) {

    if (NODES[id]) {
      NODES[id].rx = pos.rx;
      NODES[id].ry = pos.ry;
    }

  }

  renderAll();
}

/* ============================================================
   9. EVENT LISTENERS
============================================================ */

/** ENTER: run Dijkstra and display result */
document.getElementById('btn-enter').addEventListener('click', () => {
  const start = document.getElementById('sel-start').value;
  const end   = document.getElementById('sel-end').value;

  if (!start || !end) {
    setStatus('⚠ Pilih titik awal dan akhir terlebih dahulu!', false);
    return;
  }
  if (start === end) {
    setStatus('⚠ Titik awal dan akhir harus berbeda!', false);
    return;
  }

  // Reset any running animation
  resetAnimation();
  viewState.startNode = start;
  viewState.endNode   = end;

  // Run Dijkstra
  const result = dijkstra(GRAPH, start, end);
  viewState.path = result.path;

  if (!result.path.length || result.totalDist === Infinity) {
    // No path found
    document.getElementById('res-route').textContent = 'TIDAK ADA RUTE';
    document.getElementById('res-total').textContent = '—';
    setStatus(`Tidak ada jalur antara ${start} → ${end}`, false);
  } else {
    // Display results
    document.getElementById('res-route').textContent = result.path.join(' → ');
    document.getElementById('res-total').textContent = `${result.totalDist} METER`;
    animState.totalDist = result.totalDist;

    // Pre-position person icon at start node (hidden)
    const sNode = NODES[start];
    movePerson(sNode.rx * canvas.width, sNode.ry * canvas.height, 0);

    setStatus(
      `Rute ditemukan: ${result.path.join(' → ')} | ${result.totalDist}m — Klik START.`,
      false
    );
  }

  renderAll();
});

/** START button */
document.getElementById('btn-start').addEventListener('click', startAnimation);

/** PAUSE button */
document.getElementById('btn-pause').addEventListener('click', pauseAnimation);

/** RESET button */
document.getElementById('btn-reset').addEventListener('click', () => {
  resetAnimation();
  viewState.path      = [];
  viewState.startNode = null;
  viewState.endNode   = null;

  document.getElementById('res-route').textContent = '—';
  document.getElementById('res-total').textContent = '—';
  document.getElementById('res-travel').textContent = '0';

  setStatus('Reset selesai. Pilih titik awal dan akhir.', false);
  renderAll();
});

/** RANDOM START */
document.getElementById('btn-rs').addEventListener('click', () => {
  const ids    = Object.keys(NODES);
  const endVal = document.getElementById('sel-end').value;
  let pick;
  do { pick = ids[Math.floor(Math.random() * ids.length)]; } while (pick === endVal);
  document.getElementById('sel-start').value = pick;
});

/** RANDOM END */
document.getElementById('btn-re').addEventListener('click', () => {
  const ids      = Object.keys(NODES);
  const startVal = document.getElementById('sel-start').value;
  let pick;
  do { pick = ids[Math.floor(Math.random() * ids.length)]; } while (pick === startVal);
  document.getElementById('sel-end').value = pick;
});

/** Speed slider */
document.getElementById('spd').addEventListener('input', (e) => {
  animState.speedMult = parseInt(e.target.value, 10);
  document.getElementById('spd-val').textContent = `${e.target.value}x`;
});

/** Canvas hover → tooltip */
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx   = (e.clientX - rect.left)  * (canvas.width  / rect.width);
  const my   = (e.clientY - rect.top)   * (canvas.height / rect.height);
  const tip  = document.getElementById('tooltip');

  let hit = null;
  for (const [nid, node] of Object.entries(NODES)) {
    const p = toPx(node.rx, node.ry);
    if (Math.hypot(mx - p.x, my - p.y) < 14) { hit = nid; break; }
  }

  if (hit) {
    viewState.hoverNode = hit;
    const n = NODES[hit];
    document.getElementById('tt-id').textContent   = hit;
    document.getElementById('tt-name').textContent = n.name;
    document.getElementById('tt-tag').textContent  =
      viewState.path.includes(hit) ? '✔ Pada jalur terpendek' : '';

    tip.style.display = 'block';
    tip.style.left    = `${e.clientX + 14}px`;
    tip.style.top     = `${e.clientY - 8}px`;
  } else {
    viewState.hoverNode    = null;
    tip.style.display = 'none';
  }

  if (!animState.active) renderAll();
});

canvas.addEventListener('mouseleave', () => {
  viewState.hoverNode    = null;
  document.getElementById('tooltip').style.display = 'none';
  if (!animState.active) renderAll();
});

/** Resize canvas when window resizes */
window.addEventListener('resize', resizeCanvas);

/* ============================================================
   10. INITIALIZATION
============================================================ */
(function init() {

  randomizeMapLayout();

  populateSelects();
  resizeCanvas();
  setStatus('Pilih titik awal dan akhir, lalu klik ENTER.', false);

})();