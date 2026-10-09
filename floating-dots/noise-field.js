/**
 * Independent 2D value noise and fractal Brownian motion.
 * Copyright (c) 2026 PlonGuo. Released under the MIT License.
 *
 * A noise field is not a random number generator. Random numbers give
 * each position an unrelated value, which makes neighbouring dots move
 * in unrelated directions and reads as visual static. Value noise
 * interpolates between lattice values, so nearby positions get nearby
 * values — that continuity is what makes a group of dots flow together
 * like water rather than twitch like dust.
 *
 * This is the classic value-noise construction: hash lattice corners to
 * pseudo-random values, then smooth-interpolate between them. The hash
 * here is an integer mixer; it is not derived from any third-party
 * implementation.
 */

/** Integer hash (xorshift-style mixer) returning a float in -1..1. */
function hash2(x, y, seed) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** Smoothstep-like fade. Gives the field a continuous first derivative. */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Create a deterministic 2D value-noise function bounded to -1..1. */
export function createNoise2D(seed = 0) {
  return function noise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const top = lerp(hash2(x0, y0, seed), hash2(x0 + 1, y0, seed), fx);
    const bottom = lerp(hash2(x0, y0 + 1, seed), hash2(x0 + 1, y0 + 1, seed), fx);
    return lerp(top, bottom, fy);
  };
}

/**
 * Fractal Brownian motion: sum several noise octaves at increasing
 * frequency and decreasing amplitude. One octave gives a smooth swell;
 * stacking octaves adds fine detail on top of it, which is what makes
 * the motion read as water rather than as a single slow blob.
 */
export function fbm(noise, x, y, octaves = 3, lacunarity = 2, gain = 0.5) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return norm === 0 ? 0 : sum / norm;
}
