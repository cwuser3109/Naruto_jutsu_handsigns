// One hand = 21 landmarks, each {x, y, z}
type Landmark = { x: number; y: number; z: number; visibility?: number };

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

// Build a descriptor from a SINGLE hand (whichever is visible)
export function buildSignDescriptor(
  hands: { landmarks: Landmark[]; handedness: 'Left' | 'Right' }[]
): number[] | null {
  if (hands.length === 0) return null;
  return normalizeHand(hands[0].landmarks);
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export interface SignTemplate {
  name: string;
  descriptor: number[];
}

export function recognizeSign(
  descriptor: number[],
  templates: SignTemplate[],
  threshold = 0.6
): { name: string; confidence: number } | null {
  let best: SignTemplate | null = null;
  let bestDist = Infinity;
  for (const t of templates) {
    if (t.descriptor.length !== descriptor.length) continue;
    const d = distance(descriptor, t.descriptor);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  if (!best || bestDist > threshold) return null;
  return { name: best.name, confidence: 1 - bestDist / threshold };
}