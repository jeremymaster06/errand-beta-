/* Route solver: shortest open path start -> (all stops) -> end, with precedence constraints.
 * Works in the browser (window.RouteSolver) and in Node (module.exports).
 * Matrix M is (n+2)x(n+2): indices 0..n-1 are stops, n = start, n+1 = end.
 * If there is no fixed end, pass zeros in column n+1.
 * prec: array of [a,b] meaning stop a must be visited before stop b (e.g. pickup before its drop-off).
 * Exact Held-Karp DP (bitmask) for n <= EXACT_MAX; beyond that a feasible greedy + local search heuristic. */
(function (root) {
  'use strict';
  const EXACT_MAX = 12;

  function predMasks(n, prec) {
    const pm = new Array(n).fill(0);
    for (const [a, b] of prec) {
      if (a < 0 || b < 0 || a >= n || b >= n || a === b) throw new Error('Invalid precedence pair ' + a + ',' + b);
      pm[b] |= (1 << a);
    }
    return pm;
  }

  function hasCycle(n, prec) {
    const adj = Array.from({ length: n }, () => []), indeg = new Array(n).fill(0);
    for (const [a, b] of prec) { adj[a].push(b); indeg[b]++; }
    const q = []; for (let i = 0; i < n; i++) if (!indeg[i]) q.push(i);
    let seen = 0;
    while (q.length) { const v = q.shift(); seen++; for (const w of adj[v]) if (--indeg[w] === 0) q.push(w); }
    return seen !== n;
  }

  function routeCost(order, M) {
    const n = M.length - 2; if (!order.length) return M[n][n + 1];
    let c = M[n][order[0]];
    for (let i = 1; i < order.length; i++) c += M[order[i - 1]][order[i]];
    return c + M[order[order.length - 1]][n + 1];
  }

  function isFeasible(order, prec) {
    const pos = new Map(order.map((v, i) => [v, i]));
    return prec.every(([a, b]) => !pos.has(a) || !pos.has(b) || pos.get(a) < pos.get(b));
  }

  /* Stable repair: keep the given order as much as possible but move each stop after its predecessors. */
  function repairOrder(order, prec) {
    const placed = new Set(), out = [], rest = order.slice();
    const preds = new Map(); for (const [a, b] of prec) { if (!preds.has(b)) preds.set(b, []); preds.get(b).push(a); }
    let guard = 0;
    while (rest.length) {
      const i = rest.findIndex(v => (preds.get(v) || []).every(p => placed.has(p) || !order.includes(p)));
      if (i < 0 || ++guard > 10000) throw new Error('Precedence cycle');
      const v = rest.splice(i, 1)[0]; out.push(v); placed.add(v);
    }
    return out;
  }

  function exact(n, M, pm) {
    const S = n, E = n + 1, FULL = (1 << n) - 1, INF = Infinity;
    const dp = new Float64Array((1 << n) * n).fill(INF), par = new Int8Array((1 << n) * n).fill(-1);
    for (let j = 0; j < n; j++) if (!pm[j]) dp[(1 << j) * n + j] = M[S][j];
    for (let mask = 1; mask <= FULL; mask++) {
      for (let j = 0; j < n; j++) {
        const cur = dp[mask * n + j]; if (cur === INF || !(mask & (1 << j))) continue;
        for (let k = 0; k < n; k++) {
          if (mask & (1 << k) || (pm[k] & mask) !== pm[k]) continue;
          const nm = mask | (1 << k), v = cur + M[j][k];
          if (v < dp[nm * n + k]) { dp[nm * n + k] = v; par[nm * n + k] = j; }
        }
      }
    }
    let best = INF, last = -1;
    for (let j = 0; j < n; j++) { const v = dp[FULL * n + j] + M[j][E]; if (v < best) { best = v; last = j; } }
    const order = []; let mask = FULL, j = last;
    while (j >= 0) { order.push(j); const p = par[mask * n + j]; mask &= ~(1 << j); j = p; }
    order.reverse();
    return { order, cost: best, exact: true };
  }

  function heuristic(n, M, prec) {
    const S = n;
    // Greedy nearest feasible neighbour
    const preds = Array.from({ length: n }, () => []); for (const [a, b] of prec) preds[b].push(a);
    const used = new Array(n).fill(false); let order = [], cur = S;
    for (let step = 0; step < n; step++) {
      let best = -1, bc = Infinity;
      for (let k = 0; k < n; k++) if (!used[k] && preds[k].every(p => used[p]) && M[cur][k] < bc) { bc = M[cur][k]; best = k; }
      used[best] = true; order.push(best); cur = best;
    }
    // Local search: relocate single stop + 2-opt segment reversal, keep feasibility
    let bestCost = routeCost(order, M), improved = true, iter = 0;
    while (improved && iter++ < 500) {
      improved = false;
      for (let i = 0; i < n && !improved; i++) for (let j = 0; j < n && !improved; j++) {
        if (i === j) continue;
        const o = order.slice(); const [v] = o.splice(i, 1); o.splice(j, 0, v);
        if (isFeasible(o, prec)) { const c = routeCost(o, M); if (c < bestCost - 1e-9) { order = o; bestCost = c; improved = true; } }
      }
      for (let i = 0; i < n - 1 && !improved; i++) for (let j = i + 1; j < n && !improved; j++) {
        const o = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
        if (isFeasible(o, prec)) { const c = routeCost(o, M); if (c < bestCost - 1e-9) { order = o; bestCost = c; improved = true; } }
      }
    }
    return { order, cost: bestCost, exact: false };
  }

  function solve(M, prec = [], opts = {}) {
    const n = M.length - 2;
    if (n < 0) throw new Error('Matrix must include start and end');
    if (n === 0) return { order: [], cost: M[0][1], exact: true };
    if (hasCycle(n, prec)) throw new Error('Precedence cycle');
    const pm = predMasks(n, prec);
    const max = opts.exactMax == null ? EXACT_MAX : opts.exactMax;
    return n <= max ? exact(n, M, pm) : heuristic(n, M, prec);
  }

  /* Geography helpers */
  function haversineMi(a, b) {
    const R = 3958.8, toR = x => x * Math.PI / 180;
    const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /* Build a road-distance-estimate matrix (miles). roadFactor approximates street grid vs straight line. */
  function buildMatrix(stops, start, end, roadFactor = 1.35) {
    const pts = stops.concat([start, end || start]); const n = stops.length;
    return pts.map((a, i) => pts.map((b, j) => (i === j || (!end && j === n + 1)) ? 0 : haversineMi(a, b) * roadFactor));
  }

  const api = { solve, routeCost, isFeasible, repairOrder, hasCycle, haversineMi, buildMatrix, EXACT_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RouteSolver = api;
})(typeof window !== 'undefined' ? window : globalThis);
