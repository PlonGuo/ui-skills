// 照片沿一条螺旋轨道循环移动，像照片被旋转楼梯依次送到镜头前。
// 透视投影把三维位置换算为屏幕坐标，让近处的照片更大、远处更小。
// 每个角分别投影，贴图再分成小三角形绘制，以保持轮廓和画面一致。

const TAU = Math.PI * 2;

export const WALL_DEFAULTS = {
  helix: { radius: 1, pitch: 1.986, turns: 1.82, cardsPerTurn: 15 / 1.82, radiusJitter: 0 },
  cardWidth: 0.531,
  cardAspect: 1.378,
  sizeJitter: 0,
  cornerRadius: 0.075,
  camera: { fovDeg: 15.08, distance: 4.8, height: 0, lookDown: 0, rollDeg: 0, centreX: 0.491, centreY: 0.445 },
  cameraFacing: 0.4,
  startAngleDeg: 149.7,
  cardTilt: 0.196,
  axisRollDeg: 2.4,
  axisPitchDeg: -1.2,
  driftDegPerSec: 7,
  farBrightness: 0.48,
  focalY: 0.5,
  images: [],
  showIndex: false,
  endFade: 0.12,
  wheelGain: 0.12,
  maxSpin: 360,
  spinDecay: 4.5,
  blendRate: 2.2,
};

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 固定间距保持播放顺序；只有显式开启 jitter 时才使用可复现的随机尺寸。
export function buildCards(count, seed, opts) {
  const { radius, pitch, turns, radiusJitter } = opts.helix;
  const length = pitch * turns;
  const cards = [];
  for (let i = 0; i < count; i += 1) {
    const r2 = hash(seed + i * 2.71 + 11);
    const r3 = hash(seed + i * 4.13 + 29);

    // 图片顺序与螺旋上的位置一一对应，首尾间距和中间的间距一致。
    const angle = opts.startAngleDeg * Math.PI / 180 - i * turns * TAU / count;
    const unwrappedY = (angle - Math.PI / 2) * pitch / TAU;
    const y = unwrappedY - Math.round(unwrappedY / length) * length;
    const r = radius * (1 + (r2 - 0.5) * radiusJitter);

    const size = 1 + (r3 - 0.5) * opts.sizeJitter;
    const w = opts.cardWidth * size;

    cards.push({
      // Position in the set, which is also the play order.
      index: i,
      // Position on the helix, before the spin is applied.
      angle,
      radius: r,
      y,
      // Card size in world units.
      w,
      h: w / opts.cardAspect,
      // In-plane twist about the card's own normal, radians.
      twist: 0,
      lean: 0,
      // Keep the reference subject centred within its crop.
      panX: 0.5,
      focalY: opts.focalY,
    });
  }
  return cards;
}

export function mountPhotoWall(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('mountPhotoWall(container): container must be an HTMLElement');
  }

  const settings = {
    ...WALL_DEFAULTS, ...options,
    helix: { ...WALL_DEFAULTS.helix, ...options.helix },
    camera: { ...WALL_DEFAULTS.camera, ...options.camera },
  };
  let disposed = false;
  let rafId = 0;
  let running = false;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // One Image per distinct URL. `imageReady` flips once the first one decodes,
  // so the wall shows photos as soon as it can; the rest fill in as they load.
  const urls = settings.images && settings.images.length
    ? settings.images
    : [settings.imageUrl || './assets/photo.jpg'];
  const images = urls.map(url => {
    const img = new Image();
    img.decoding = 'async';
    img.addEventListener('load', () => { imageReady = true; draw(); });
    img.addEventListener('error', () => { imageFailed = true; draw(); });
    img.src = url;
    return img;
  });
  let imageReady = false;
  let imageFailed = false;
  function imageFor(card) {
    const img = images[card.index % images.length];
    return img && img.complete && img.naturalWidth ? img : null;
  }

  const reduceMotion = globalThis.matchMedia
    ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  // --- state -----------------------------------------------------------
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cards = [];
  let spinAngle = 0;      // helix rotation, radians
  let spin = 0;           // extra angular velocity from gestures, deg/s
  let driftRate = 0;      // eased idle rate, deg/s
  let lastTime = 0;
  let staticAngle = 0;
  let rise = 0;           // how far the cards have climbed along the axis, world units
  let staticRise = 0;


  function resize() {
    updateCamWorld();
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width || container.clientWidth || 0));
    height = Math.max(1, Math.round(rect.height || container.clientHeight || 0));
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    cards = buildCards(cardTotal(), 7, settings);
    draw();
  }

  // --- camera ----------------------------------------------------------
  // Built once per frame from the current viewport, so a resize costs nothing
  // beyond rebuilding a handful of numbers.
  function camera() {
    const cam = settings.camera;
    // Fit the same composition to narrow viewports without enlarging cards
    // beyond the screen. Desktop matches the 2612 × 1266 reference.
    const sceneHeight = Math.min(height, width / (2612 / 1266));
    const f = (sceneHeight / 2) / Math.tan((cam.fovDeg * Math.PI) / 360);

    // The camera orbits at `distance` from the axis, a little above the aim
    // point, and looks down slightly.
    const aimY = -cam.lookDown;
    const camY = cam.height;
    const camPos = [0, camY, cam.distance];
    const aim = [0, aimY, 0];

    const fwd = norm(sub(aim, camPos));
    let right = norm(cross(fwd, [0, 1, 0]));
    // Degenerate only if the camera looks straight up or down, which it never
    // does here.
    if (!Number.isFinite(right[0])) right = [1, 0, 0];
    const up = cross(right, fwd);

    // Camera roll: rotate the view-plane axes about the view direction. This is
    // what turns the helix's mostly-horizontal sweep into a diagonal drift.
    const roll = (cam.rollDeg * Math.PI) / 180;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const rightR = add(scale(right, cr), scale(up, sr));
    const upR = add(scale(up, cr), scale(right, -sr));

    return {
      f,
      cx: width * cam.centreX,
      cy: height * cam.centreY,
      camPos,
      basis: [rightR, upR, fwd],
    };
  }

  // World point -> [screenX, screenY, depth]. Depth is positive in front of the
  // camera; a non-positive depth means the point is behind it.
  function project(cam, p) {
    const q = sub(p, cam.camPos);
    const [right, up, fwd] = cam.basis;
    const depth = dot(q, fwd);
    if (depth <= 1e-4) return [NaN, NaN, depth];
    const x = dot(q, right);
    const y = dot(q, up);
    return [cam.cx + (cam.f * x) / depth, cam.cy - (cam.f * y) / depth, depth];
  }

  // The camera's world position, derived from the camera settings. Kept as a
  // plain value rather than read back from camera(), because cardCorners needs
  // it and does not otherwise depend on the view.
  let camWorld = [0, WALL_DEFAULTS.camera.height, WALL_DEFAULTS.camera.distance];
  function updateCamWorld() {
    camWorld = [0, settings.camera.height, settings.camera.distance];
  }

  // --- vector helpers --------------------------------------------------
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(a) {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / L, a[1] / L, a[2] / L];
  }

  // The four world-space corners of a card, in the order
  // top-left, top-right, bottom-right, bottom-left as seen from outside the
  // helix.
  //
  // Orientation: a card's normal is a blend between "outward along the radius"
  // and "toward the camera". The radial part is what makes the ring read as a
  // ring; the camera-facing part keeps the cards at the sides of the frame
  // readable. Aiming them purely outward turns them edge-on as they reach the
  // left and right of the viewport, which the reference never shows.
  function cardCorners(card, spin) {
    const a = localAngle(card, rise);
    const ca = Math.cos(a);
    const sa = Math.sin(a);

    // Card centre on the helix, in the helix's own frame.
    const centre = localCentre(card, spin);

    const outward = [ca, 0, sa];
    const tangent = [-sa, 0, ca];

    // The card's facing direction: a blend between straight out from the axis
    // and straight at the camera. Purely radial turns cards edge-on at the left
    // and right of the frame; the blend keeps them legible everywhere, which is
    // what the reference shows.
    // The camera position expressed in the helix frame, so "toward the camera"
    // is consistent with the axis tilt.
    const toCamera = norm(sub(camLocal(), centre));
    // On the far strand the outward normal points away from the viewer; flip it
    // so those cards show their picture the right way round instead of a
    // mirrored back.
    const facingDot = dot(outward, toCamera);
    const out = facingDot >= 0 ? outward : scale(outward, -1);
    // Keep the plane continuous when it passes edge-on. A constant blend
    // changes its orientation abruptly when the outward normal flips.
    const alignment = Math.abs(dot(outward, toCamera));
    const blend = settings.cameraFacing * (facingDot >= 0 ? 1 : 0.125) * Math.min(1, alignment / 0.08);
    const facing = norm(add(scale(out, 1 - blend), scale(toCamera, blend)));

    // Build an orthonormal frame (u, v, n): u across the card, v up it, n its
    // normal. "Up" is the world's up expressed in the helix frame, not the helix
    // axis: the axis is laid along the drift direction, and using it as up
    // would lay every card on its side.
    const n0 = facing;
    let u0 = cross(worldUpLocal(), n0);
    if (Math.hypot(u0[0], u0[1], u0[2]) < 1e-4) u0 = tangent;
    u0 = norm(u0);
    const v0 = norm(cross(n0, u0));

    // Lean: tip the card's top toward or away from the viewer, a rotation
    // about u. Neighbouring cards then sit at slightly different pitches.
    const cl = Math.cos(card.lean);
    const sl = Math.sin(card.lean);
    const v1 = norm(add(scale(v0, cl), scale(n0, sl)));
    const n1 = norm(cross(u0, v1));

    // Twist: the card's own in-plane rotation, about its normal.
    const twist = card.twist + settings.cardTilt * Math.cos(a);
    const ct = Math.cos(twist);
    const st = Math.sin(twist);
    const u2 = norm(add(scale(u0, ct), scale(v1, st)));
    const v2 = norm(cross(n1, u2));

    const hw = card.w / 2;
    const hh = card.h / 2;
    return [
      add(centre, add(scale(u2, -hw), scale(v2, hh))),
      add(centre, add(scale(u2, hw), scale(v2, hh))),
      add(centre, add(scale(u2, hw), scale(v2, -hh))),
      add(centre, add(scale(u2, -hw), scale(v2, -hh))),
    ].map(toWorld);
  }

  // World up and the camera position, expressed in the helix frame, so cards
  // stay upright on screen even when the axis leans.
  function worldUpLocal() { return toLocal([0, 1, 0]); }
  function camLocal() { return toLocal(camWorld); }

  // Project every card and decide which ones are worth drawing. Kept separate
  // from draw() so the geometry tests can measure exactly the set of quads the
  // renderer would paint, including the culls.
  function prepare(cam) {
    const out = [];
    for (const card of cards) {
      const world = cardCorners(card, spinAngle);
      const pts = world.map(p => project(cam, p));
      if (pts.some(p => !Number.isFinite(p[0]))) continue;


      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      const minX = Math.min.apply(null, xs); const maxX = Math.max.apply(null, xs);
      const minY = Math.min.apply(null, ys); const maxY = Math.max.apply(null, ys);

      // Cull anything entirely off-screen.
      if (maxX < 0 || minX > width || maxY < 0 || minY > height) continue;

      // On-screen area, by the shoelace formula on the quad. A card seen almost
      // edge-on collapses to a sliver whose corners are numerically unstable;
      // those contribute nothing readable and would poison any measurement
      // taken from the quads, so drop them here rather than at draw time.
      let area2 = 0;
      for (let i = 0; i < 4; i += 1) {
        const a = pts[i]; const b = pts[(i + 1) % 4];
        area2 += a[0] * b[1] - b[0] * a[1];
      }
      if (Math.abs(area2) / 2 < 240) continue;

      const depth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
      out.push({ card, pts, depth, near: isNear(card, spinAngle) });
    }
    // Back to front, so nearer cards cover further ones.
    out.sort((a, b) => b.depth - a.depth);
    return out;
  }

  function draw() {
    if (disposed) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const cam = camera();
    const prepared = prepare(cam);
    for (const item of prepared) drawCard(item, cam);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawCard({ card, pts, depth }, cam) {
    const [tl, tr, br, bl] = pts;

    // Silhouette: the true projected quad, with rounded corners. Drawn as a
    // path in screen space so the trapezoid is exact.
    const edgeTop = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
    const edgeLeft = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
    const r = Math.min(
      settings.cornerRadius * Math.max(edgeTop, edgeLeft),
      edgeTop / 2,
      edgeLeft / 2,
    );

    const fade = endFadeAlpha(card);
    if (fade <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = fade;
    roundedQuad(ctx, tl, tr, br, bl, r);
    ctx.clip();

    const img = imageFor(card);
    if (img) {
      drawTexture(img, card, pts);
      if (settings.showIndex) {
        const w = card.w; const h = card.h;
        ctx.setTransform(
          (tr[0] - tl[0]) / w * dpr, (tr[1] - tl[1]) / w * dpr,
          (bl[0] - tl[0]) / h * dpr, (bl[1] - tl[1]) / h * dpr,
          (tl[0] + tr[0] + br[0] + bl[0]) / 4 * dpr,
          (tl[1] + tr[1] + br[1] + bl[1]) / 4 * dpr,
        );
        drawIndex(card, w, h);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Depth dimming: cards further back fade toward black, so the near
      // strand reads first. Linear in depth between the axis's near and far
      // extremes.
      const shade = depthShade(depth, cam);
      if (shade > 0.001) {
        ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = imageFailed ? '#1b1b1b' : '#141414';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  // Split the image into small triangles before projecting it, like laying
  // tiles over a curved surface. A single affine draw cannot cover a trapezoid
  // and leaves black wedges at its edges.
  function drawTexture(img, card, [tl, tr, , bl]) {
    const columns = 6; const rows = 4;
    function point(u, v) {
      const z = tl[2] + u * (tr[2] - tl[2]) + v * (bl[2] - tl[2]);
      return [0, 1].map(k => (tl[k] * tl[2]
        + u * (tr[k] * tr[2] - tl[k] * tl[2])
        + v * (bl[k] * bl[2] - tl[k] * tl[2])) / z);
    }
    function triangle(source, dest) {
      const [a, b, c] = source;
      const [p, q, r] = dest;
      const sx1 = b[0] - a[0]; const sy1 = b[1] - a[1];
      const sx2 = c[0] - a[0]; const sy2 = c[1] - a[1];
      const det = sx1 * sy2 - sx2 * sy1;
      const m11 = ((q[0] - p[0]) * sy2 - (r[0] - p[0]) * sy1) / det;
      const m21 = ((r[0] - p[0]) * sx1 - (q[0] - p[0]) * sx2) / det;
      const m12 = ((q[1] - p[1]) * sy2 - (r[1] - p[1]) * sy1) / det;
      const m22 = ((r[1] - p[1]) * sx1 - (q[1] - p[1]) * sx2) / det;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.beginPath();
      // Small overlap removes anti-aliased seams between adjacent triangles;
      // the outer rounded-quad clip still defines the exact card silhouette.
      const centre = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3];
      dest.forEach((v, i) => {
        const dx = v[0] - centre[0]; const dy = v[1] - centre[1];
        const k = 0.6 / (Math.hypot(dx, dy) || 1);
        const x = v[0] + dx * k; const y = v[1] + dy * k;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.clip();
      ctx.setTransform(m11 * dpr, m12 * dpr, m21 * dpr, m22 * dpr,
        (p[0] - m11 * a[0] - m21 * a[1]) * dpr,
        (p[1] - m12 * a[0] - m22 * a[1]) * dpr);
      drawCover(ctx, img, 0, 0, card.w, card.h, card);
      ctx.restore();
    }
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const uv = [[x / columns, y / rows], [(x + 1) / columns, y / rows],
          [(x + 1) / columns, (y + 1) / rows], [x / columns, (y + 1) / rows]];
        const dest = uv.map(([u, v]) => point(u, v));
        const source = uv.map(([u, v]) => [u * card.w, v * card.h]);
        for (const ids of [[0, 1, 2], [0, 2, 3]]) triangle(ids.map(i => source[i]), ids.map(i => dest[i]));
      }
    }
  }

  // 1 in the middle of the helix, easing to 0 at either end.
  function endFadeAlpha(card) {
    const L = helixLength();
    const y = wrapCentred(card.y + rise, L);          // -L/2 .. L/2
    const edge = L / 2 - Math.abs(y);                  // distance to the nearer end
    const band = Math.max(1e-6, settings.endFade * L);
    const t = clamp(edge / band, 0, 1);
    return t * t * (3 - 2 * t);                        // smoothstep
  }

  // The card's play-order number, drawn in card space so it tilts and shrinks
  // with the card.
  function drawIndex(card, w, h) {
    const n = String(card.index + 1);
    const size = h * 0.16;
    const pad = h * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-w / 2 + pad, -h / 2 + pad, size * (0.75 + 0.55 * n.length), size * 1.35);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(n, -w / 2 + pad + size * 0.35, -h / 2 + pad + size * 0.2);
  }

  // 0 for a card at the front of the helix, 1 - farBrightness at the back.
  function depthShade(depth, cam) {
    const axis = Math.hypot(...cam.camPos);
    const r = settings.helix.radius;
    const t = clamp((depth - (axis - r)) / (2 * r), 0, 1);
    return t * (1 - settings.farBrightness);
  }

  function roundedQuad(context, tl, tr, br, bl, r) {
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const len = Math.max(r, 1e-3);
    const along = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return (a[0] === b[0] && a[1] === b[1]) ? 0 : len / L;
    };
    const t1 = along(tl, tr); const t2 = along(bl, br);
    const l1 = along(tl, bl); const l2 = along(tr, br);

    context.beginPath();
    context.moveTo(...lerp(tl, tr, t1));
    context.lineTo(...lerp(tr, tl, t1));
    context.quadraticCurveTo(tr[0], tr[1], ...lerp(tr, br, l2));
    context.lineTo(...lerp(br, tr, l2));
    context.quadraticCurveTo(br[0], br[1], ...lerp(br, bl, t2));
    context.lineTo(...lerp(bl, br, t2));
    context.quadraticCurveTo(bl[0], bl[1], ...lerp(bl, tl, l1));
    context.lineTo(...lerp(tl, bl, l1));
    context.quadraticCurveTo(tl[0], tl[1], ...lerp(tl, tr, t1));
    context.closePath();
  }

  // Draw the photo so it covers the card, cropping rather than letterboxing.
  // The crop is centred horizontally per card and biased vertically, so a wall
  // of repeated photos does not all show the same slice.
  function drawCover(context, img, x, y, w, h, card) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih);
    const sw = w / s;
    const sh = h / s;
    const sx = (iw - sw) * (card.panX !== undefined ? card.panX : 0.5);
    const sy = (ih - sh) * (card.focalY !== undefined ? card.focalY : settings.focalY);
    context.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function frame(now) {
    if (!running || disposed) return;
    rafId = requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    advance(dt);
    draw();
  }

  function advance(dt) {
    const target = settings.driftDegPerSec;
    driftRate += (target - driftRate) * Math.min(1, settings.blendRate * dt);
    spin *= Math.exp(-settings.spinDecay * dt);
    if (Math.abs(spin) < 0.01) spin = 0;
    const dAngle = (((driftRate + spin) * Math.PI) / 180) * dt;
    spinAngle = (spinAngle + dAngle) % TAU;

    // Screw motion: every radian of turn lifts the cards by pitch / 2pi, so
    // each card slides up along the helix rather than circling at a fixed
    // height. The spiral itself keeps its shape; the photos climb it.
    rise = wrapCentred(rise + (dAngle * settings.helix.pitch) / TAU, helixLength());

    staticAngle = spinAngle;
    staticRise = rise;
  }

  // --- input -----------------------------------------------------------
  // The wheel drives the helix's angular velocity, and the on-screen travel is
  // a consequence of that rotation rather than a separate translation.
  //   wheel down (deltaY > 0) -> cards climb faster
  //   wheel up   (deltaY < 0) -> cards slow, then reverse
  function onWheel(event) {
    if (disposed) return;
    event.preventDefault();
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;        // lines -> px
    else if (event.deltaMode === 2) delta *= height;
    const impulse = clamp(delta * settings.wheelGain, -settings.maxSpin, settings.maxSpin);
    spin = clamp(spin + impulse, -settings.maxSpin, settings.maxSpin);
  }

  // Listen on the window so a gesture anywhere on the page drives the wall.
  // Nothing scrolls here, so preventing the default is safe.
  globalThis.addEventListener('wheel', onWheel, { passive: false, capture: false });

  let touchY = null;
  function onTouchStart(event) {
    if (event.touches.length !== 1) return;
    touchY = event.touches[0].clientY;
  }
  function onTouchMove(event) {
    if (touchY === null || event.touches.length !== 1) return;
    const y = event.touches[0].clientY;
    const dy = touchY - y;   // swipe up -> positive, matching forward scroll
    touchY = y;
    const impulse = clamp(dy * settings.wheelGain * 3, -settings.maxSpin, settings.maxSpin);
    spin = clamp(spin + impulse, -settings.maxSpin, settings.maxSpin);
  }
  function onTouchEnd() { touchY = null; }
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchEnd, { passive: true });

  // --- lifecycle -------------------------------------------------------
  const resizeObserver = globalThis.ResizeObserver
    ? new ResizeObserver(() => resize())
    : null;
  if (resizeObserver) resizeObserver.observe(container);

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }
  document.addEventListener('visibilitychange', onVisibility);

  function start() {
    if (disposed || running) return;
    if (reduceMotion && reduceMotion.matches) {
      spinAngle = staticAngle;
      rise = staticRise;
      draw();
      return;
    }
    running = true;
    lastTime = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    globalThis.removeEventListener('wheel', onWheel);
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchEnd);
    document.removeEventListener('visibilitychange', onVisibility);
    if (resizeObserver) resizeObserver.disconnect();
    canvas.remove();
    cards = [];
  }

  // --- introspection used by the tests ---------------------------------
  // Screen position of the point on the helix nearest the camera, at the given
  // extra angle. Screen drift is measured along the ring rather than by
  // following one card: cards also move up and down the helix, so a single
  // card's on-screen path mixes the sweep with its own vertical travel.
  function probe(range) {
    const cam = camera();
    const r = settings.helix.radius;
    const a = spinAngle + (range || 0);
    return project(cam, toWorld([Math.cos(a) * r, 0, Math.sin(a) * r]));
  }

  resize();
  start();

  // Mean screen velocity of the cards, px/s.
  //
  // Probing a fixed point on the ring is misleading: at the point nearest the
  // camera the ring is travelling almost directly toward the lens, so its
  // projected speed there is near zero, while the fastest screen motion happens
  // at the sides. What reads as "how fast the wall moves" is the average
  // displacement of the cards the viewer can actually see, so measure that.
  //
  // Evaluated as a central difference in time, so it is correct at any angular
  // rate including zero.
  // Is this card on the near strand (outward side facing the camera)?
  function isNear(card, spin) {
    const c = localCentre(card, spin);
    return dot([c[0], 0, c[2]], sub(camLocal(), c)) > 0;
  }

  // Mean screen velocity of visible cards, px/s; optionally only one strand.
  function screenVelocity(strand) {
    const w = ((driftRate + spin) * Math.PI) / 180;
    const step = 1 / 120;                    // seconds, small enough for a clean derivative
    const dLift = (w * step * settings.helix.pitch) / TAU;
    const cam = camera();
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const card of cards) {
      const near = isNear(card, spinAngle);
      if (strand === 'near' && !near) continue;
      if (strand === 'far' && near) continue;
      const before = project(cam, cardCentre(card, spinAngle - w * step, rise - dLift));
      const after = project(cam, cardCentre(card, spinAngle + w * step, rise + dLift));
      if (!Number.isFinite(before[0]) || !Number.isFinite(after[0])) continue;
      if (after[0] < -40 || after[0] > width + 40) continue;
      if (after[1] < -40 || after[1] > height + 40) continue;
      // Skip the instant a card wraps from the top of the helix to the bottom.
      if (Math.abs(after[1] - before[1]) > height / 4) continue;
      sx += (after[0] - before[0]) / (2 * step);
      sy += (after[1] - before[1]) / (2 * step);
      n += 1;
    }
    return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
  }

  function cardTotal() {
    return Math.round(settings.helix.turns * settings.helix.cardsPerTurn);
  }

  // Card centre in the helix's own frame (axis = local Y), after the turn and
  // the climb. The same wrapped height drives both coordinates, including
  // when the helix contains a fractional number of turns.
  function localCentre(card, spin, lift = rise) {
    const a = localAngle(card, lift);
    const y = wrapCentred(card.y + lift, helixLength());
    return [Math.cos(a) * card.radius, y, Math.sin(a) * card.radius];
  }
  function localAngle(card, lift) {
    // Derive angle and height from one wrapped position, so each photograph
    // returns to the same spiral after a complete cycle.
    return Math.PI / 2 + wrapCentred(card.y + lift, helixLength()) * TAU / settings.helix.pitch;
  }
  function cardCentre(card, spin, lift = rise) {
    return toWorld(localCentre(card, spin, lift));
  }
  function helixLength() {
    return settings.helix.pitch * settings.helix.turns;
  }
  function wrapCentred(v, L) {
    return v - Math.round(v / L) * L;
  }

  // Helix frame -> world frame: pitch about X (top toward the camera), then
  // roll about Z (lean in the screen plane). toLocal is the inverse.
  function axisRotation() {
    const p = (settings.axisPitchDeg * Math.PI) / 180;
    const r = (settings.axisRollDeg * Math.PI) / 180;
    const cp = Math.cos(p); const sp = Math.sin(p);
    const cr = Math.cos(r); const sr = Math.sin(r);
    return [
      [cr, -sr * cp, sr * sp],
      [sr, cr * cp, -cr * sp],
      [0, sp, cp],
    ];
  }
  function toWorld(v) {
    const R = axisRotation();
    return [dot(R[0], v), dot(R[1], v), dot(R[2], v)];
  }
  function toLocal(v) {
    const R = axisRotation();
    return [
      R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2],
      R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2],
      R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2],
    ];
  }

  return {
    canvas,
    get ready() { return imageReady; },
    advanceOnce(dt) { advance(dt); },
    renderOnce() { draw(); },
    stats() {
      const here = probe(0);
      const degPerSec = driftRate + spin;
      return {
        width,
        height,
        angleDeg: (spinAngle * 180) / Math.PI,
        rise,
        loopLength: helixLength(),
        driftRate,
        spin,
        degPerSec,
        probe: { x: here[0], y: here[1], depth: here[2] },
        velocity: screenVelocity(),
        // The DNA-strand signature: near and far strands cross the screen in
        // opposite directions.
        velocityNear: screenVelocity('near'),
        velocityFar: screenVelocity('far'),
        cardCount: cards.length,
        cards: cards.map(c => ({ ...c })),
        settings: JSON.parse(JSON.stringify(settings)),
      };
    },
    // Projected quad of every card that would actually be drawn, in the same
    // shape the renderer uses, tagged with the card's index so a caller can
    // follow one card over time. The geometry tests read this to check that the
    // perspective is really happening.
    quads() {
      const cam = camera();
      return prepare(cam).map(item => ({
        index: cards.indexOf(item.card),
        pts: item.pts,
        depth: item.depth,
        worldCentre: cardCentre(item.card, spinAngle),
        near: isNear(item.card, spinAngle),
      }));
    },
    setOptions(next) {
      const helix = { ...settings.helix, ...next.helix };
      const camera = { ...settings.camera, ...next.camera };
      Object.assign(settings, next, { helix, camera });
      resize();
    },
    start,
    stop,
    dispose,
  };
}
