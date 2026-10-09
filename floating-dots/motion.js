/**
 * Independent motion integration for the drifting-dot background.
 * Copyright (c) 2026 PlonGuo. Released under the MIT License.
 *
 * Each dot has a home and a weak spring pulling it back. Without that
 * spring the motion would be a random walk: displacement variance grows
 * without bound, so dots get swept off screen and the field ends up with
 * piled edges and an empty middle. With it, each dot orbits a small
 * neighbourhood — which is what floating debris in water actually does.
 *
 * The pointer is handled in two layers on purpose:
 *   - a repulsion force, which produces the natural pushed-aside feel
 *   - a hard position correction, which makes entry impossible
 * Force alone is not enough: the pointer teleports between frames and
 * dots carry their own velocity, so a fast sweep can overtake a dot.
 * Correction alone would look stiff, like sliding along a circular
 * sticker, with none of the viscous feel of water.
 */

import { createNoise2D, fbm } from './noise-field.js';

const noise = createNoise2D(20261009);
const MAX_DT = 0.05;

/** Remove the component of velocity pointing into the field. */
function cancelInward(point, nx, ny) {
  const inward = point.vx * nx + point.vy * ny;
  if (inward < 0) {
    point.vx -= inward * nx;
    point.vy -= inward * ny;
  }
}

/**
 * Push a point out of the pointer's repulsion circle without letting it
 * leave the container.
 *
 * The plain radial projection is not enough on its own. When the pointer
 * sits near an edge, the projected point lands outside the box; clamping
 * it back inside would place the dot straight back within the radius, so
 * the "cannot get close" guarantee would silently fail exactly where the
 * pointer spends a lot of its time. Instead we slide the dot along the
 * circle to the nearest angle that is still inside the box — which is what
 * a dot squeezed between the pointer and a wall physically does.
 */
function resolveOutOfField(point, pointer, radius, width, height) {
  const dx = point.x - pointer.x;
  const dy = point.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return;

  // Radial projection — the common case, away from the edges.
  if (distance > 1e-6) {
    const nx = dx / distance;
    const ny = dy / distance;
    const px = pointer.x + nx * radius;
    const py = pointer.y + ny * radius;
    if (px >= 0 && px <= width && py >= 0 && py <= height) {
      point.x = px;
      point.y = py;
      cancelInward(point, nx, ny);
      return;
    }
  }

  // Squeezed against an edge: walk outward from the radial direction in
  // both directions until an angle lands back inside the container.
  const baseAngle = distance > 1e-6 ? Math.atan2(dy, dx) : 0;
  const STEPS = 64;
  for (let i = 1; i <= STEPS; i += 1) {
    for (const sign of [-1, 1]) {
      const angle = baseAngle + sign * (i / STEPS) * Math.PI;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      const px = pointer.x + nx * radius;
      const py = pointer.y + ny * radius;
      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        point.x = px;
        point.y = py;
        cancelInward(point, nx, ny);
        return;
      }
    }
  }

  // No angle fits: the container is smaller than the field, so the two
  // constraints genuinely conflict. The box wins here because leaving the
  // container is the more visible defect.
  point.x = Math.min(width, Math.max(0, point.x));
  point.y = Math.min(height, Math.max(0, point.y));
}

export function stepPoints(points, params, dt) {
  const {
    width, height, time,
    driftSpeed, noiseScale, detailScale, detailWeight,
    homeStiffness, damping, repelRadius, repelStrength, maxSpeed,
    pointer,
  } = params;

  const step = Math.min(Math.max(dt, 0), MAX_DT);

  for (const point of points) {
    // 1. Flow field: two noise octaves give a slow swell plus fine
    //    detail, which is what separates "water" from "one slow blob".
    const swirl = fbm(noise, point.x * noiseScale, point.y * noiseScale, 2) * Math.PI * 2;
    const detail = fbm(noise, point.x * detailScale, point.y * detailScale + time * 0.35, 2) * Math.PI * 2;
    const angle = swirl + detail * detailWeight;
    const wobble = 0.7 + 0.3 * Math.sin(time * point.speed + point.phase);
    point.vx += Math.cos(angle) * driftSpeed * wobble * step;
    point.vy += Math.sin(angle) * driftSpeed * wobble * step;

    // 2. Home spring: the only thing keeping the field from draining away.
    point.vx += (point.homeX - point.x) * homeStiffness * step;
    point.vy += (point.homeY - point.y) * homeStiffness * step;

    // 3. Damping. Without it the spring oscillates forever.
    const decay = Math.exp(-damping * step);
    point.vx *= decay;
    point.vy *= decay;

    // 4. Pointer repulsion force. Quadratic falloff: gentle at the rim,
    //    firm up close, so the edge of the cleared area is soft.
    if (pointer.active) {
      const dx = point.x - pointer.x;
      const dy = point.y - pointer.y;
      const squared = dx * dx + dy * dy;
      if (squared < repelRadius * repelRadius && squared > 1e-8) {
        const distance = Math.sqrt(squared);
        const falloff = 1 - distance / repelRadius;
        const push = repelStrength * falloff * falloff * step;
        point.vx += (dx / distance) * push;
        point.vy += (dy / distance) * push;
      }
    }

    // 5. Speed clamp, then integrate.
    const speed = Math.hypot(point.vx, point.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      point.vx *= scale;
      point.vy *= scale;
    }
    point.x += point.vx * step;
    point.y += point.vy * step;

    // 6. Keep the dot inside the container. This runs BEFORE the hard
    //    repulsion correction: clamping afterwards could shove a dot back
    //    into the field, which is the whole thing we are preventing.
    if (point.x < 0) { point.x = 0; if (point.vx < 0) point.vx = -point.vx * 0.5; }
    if (point.x > width) { point.x = width; if (point.vx > 0) point.vx = -point.vx * 0.5; }
    if (point.y < 0) { point.y = 0; if (point.vy < 0) point.vy = -point.vy * 0.5; }
    if (point.y > height) { point.y = height; if (point.vy > 0) point.vy = -point.vy * 0.5; }

    // 7. Hard position correction: the second line of defence, and the
    //    reason "cannot get close" is a guarantee rather than a hope.
    if (pointer.active) resolveOutOfField(point, pointer, repelRadius, width, height);
  }
}

export { MAX_DT };
