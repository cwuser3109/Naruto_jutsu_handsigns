// One hand = 21 landmarks, each {x, y, z}
type Landmark = { x: number; y: number; z: number; visibility?: number };

export const HAND_DESCRIPTOR_LENGTH = 21 * 3;
// Naruto seals are two-handed: descriptor = [screen-left hand, screen-right hand]
export const SIGN_DESCRIPTOR_LENGTH = HAND_DESCRIPTOR_LENGTH * 2;

// Strip position & scale so we keep only the SHAPE of the hand.
export function normalizeHand(landmarks: Landmark[]): number[] {
  const wrist = landmarks[0];
  const shifted = landmarks.map(p => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: p.z - wrist.z,
  }));
  const ref = shifted[9];
  const scale = Math.hypot(ref.x, ref.y, ref.z) || 1e-6;

  const vec: number[] = [];
  for (const p of shifted) vec.push(p.x / scale, p.y / scale, p.z / scale);
  return vec;
}

type Hand = { landmarks: Landmark[]; handedness: 'Left' | 'Right' };

// Descriptor for ONE hand (used for recording and single-hand templates).
export function buildSingleHandDescriptor(hand: Hand): number[] {
  return normalizeHand(hand.landmarks);
}

// Descriptor from BOTH hands, ordered by wrist x. Returns null unless two hands are visible.
export function buildSignDescriptor(hands: Hand[]): number[] | null {
  if (hands.length < 2) return null;
  const [a, b] = [...hands]
    .sort((h1, h2) => h1.landmarks[0].x - h2.landmarks[0].x)
    .slice(0, 2);
  return [...normalizeHand(a.landmarks), ...normalizeHand(b.landmarks)];
}

// Everything we can compare against templates: each single hand, plus the two-hand
// descriptor when both are visible.
export function buildCandidates(hands: Hand[]): number[][] {
  const out = hands.map(buildSingleHandDescriptor);
  const both = buildSignDescriptor(hands);
  if (both) out.push(both);
  return out;
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// Swap the two hands' halves (hands crossing over each other can flip the x-order)
function swapHands(d: number[]): number[] {
  return [...d.slice(HAND_DESCRIPTOR_LENGTH), ...d.slice(0, HAND_DESCRIPTOR_LENGTH)];
}

export interface SignTemplate {
  name: string;
  descriptor: number[];
}

// Match threshold for a two-hand (126-d) descriptor. Shorter descriptors scale down
// with sqrt(length) so a single hand uses ~2.1.
// If real seals are missed raise this; if wrong seals fire lower it. The on-screen
// "closest" readout shows the actual distances to help you tune.
export const DEFAULT_MATCH_THRESHOLD = 3.0;
const thresholdFor = (length: number, base: number) =>
  base * Math.sqrt(length / SIGN_DESCRIPTOR_LENGTH);

// Closest template across all candidates (single hands and/or both hands), as a
// ratio to that length's threshold so 1-hand and 2-hand matches are comparable.
export function nearestSign(
  candidates: number[][],
  templates: SignTemplate[],
  threshold = DEFAULT_MATCH_THRESHOLD
): { name: string; distance: number; ratio: number } | null {
  let best: { name: string; distance: number; ratio: number } | null = null;
  for (const c of candidates) {
    const variants = c.length === SIGN_DESCRIPTOR_LENGTH ? [c, swapHands(c)] : [c];
    const limit = thresholdFor(c.length, threshold);
    for (const t of templates) {
      if (t.descriptor.length !== c.length) continue;
      const d = Math.min(...variants.map(v => distance(v, t.descriptor)));
      const ratio = d / limit;
      if (!best || ratio < best.ratio) best = { name: t.name, distance: d, ratio };
    }
  }
  return best;
}

export function recognizeSign(
  candidates: number[][],
  templates: SignTemplate[],
  threshold = DEFAULT_MATCH_THRESHOLD
): { name: string; confidence: number } | null {
  const best = nearestSign(candidates, templates, threshold);
  if (!best || best.ratio > 1) return null;
  return { name: best.name, confidence: 1 - best.ratio };
}
