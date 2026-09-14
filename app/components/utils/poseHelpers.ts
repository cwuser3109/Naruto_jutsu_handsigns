import { LandmarkPoint, PoseMetrics, PoseAngles, PoseData } from '../types/mediapipes';

export const calculateDistance = (point1: LandmarkPoint, point2: LandmarkPoint): number => {
  if (!point1 || !point2) return 0;
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
    Math.pow(point1.y - point2.y, 2) +
    Math.pow((point1.z || 0) - (point2.z || 0), 2)
  );
};

export const calculateAngle = (point1: LandmarkPoint, point2: LandmarkPoint, point3: LandmarkPoint): number => {
  if (!point1 || !point2 || !point3) return 0;
  
  const v1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y,
    z: (point1.z || 0) - (point2.z || 0)
  };
  
  const v2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y,
    z: (point3.z || 0) - (point2.z || 0)
  };
  
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const angle = Math.acos(Math.min(1, Math.max(-1, dot / (mag1 * mag2))));
  return angle * (180 / Math.PI);
};

export const extractPoseData = (landmarks: LandmarkPoint[]): PoseData => {
  // Ensure we have all required landmarks
  if (landmarks.length < 33) {
    throw new Error('Insufficient landmarks for pose extraction');
  }

  const metrics: PoseMetrics = {
    shoulderWidth: calculateDistance(landmarks[11], landmarks[12]),
    hipWidth: calculateDistance(landmarks[23], landmarks[24]),
    torsoHeight: calculateDistance(landmarks[11], landmarks[23]),
  };

  const angles: PoseAngles = {
    leftElbow: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
    rightElbow: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
    leftKnee: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
    rightKnee: calculateAngle(landmarks[24], landmarks[26], landmarks[28]),
    leftShoulder: calculateAngle(landmarks[11], landmarks[13], landmarks[23]),
    rightShoulder: calculateAngle(landmarks[12], landmarks[14], landmarks[24]),
  };

  return {
    timestamp: Date.now(),
    landmarks: landmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z || 0,
      visibility: lm.visibility || 0
    })),
    metrics,
    angles
  };
};

export const getPoseConnections = (): number[][] => {
  return [
    // Body
    [11, 12], [11, 23], [12, 24], [23, 24],
    // Arms
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
    // Legs
    [23, 25], [25, 27], [27, 29], [27, 31],
    [24, 26], [26, 28], [28, 30], [28, 32],
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10]
  ];
};