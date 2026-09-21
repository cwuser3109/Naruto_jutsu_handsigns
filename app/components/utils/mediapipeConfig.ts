// Must match the exact "@mediapipe/tasks-vision" version in package.json,
// otherwise the JS API and the wasm files it loads from the CDN are out of sync.
export const TASKS_VISION_VERSION = '1.0.1';

export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
