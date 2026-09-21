import { PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseMetrics {
  shoulderWidth: number;
  hipWidth: number;
  torsoHeight: number;
}

export interface PoseAngles {
  leftElbow: number;
  rightElbow: number;
  leftKnee: number;
  rightKnee: number;
  leftShoulder: number;
  rightShoulder: number;
}

export interface PoseData {
  timestamp: number;
  landmarks: LandmarkPoint[];
  metrics: PoseMetrics;
  angles: PoseAngles;
}

export interface HandInfo {
  handedness: 'Left' | 'Right';
  landmarks: LandmarkPoint[];
}

export type PoseLandmarkerInstance = PoseLandmarker;
export type HandLandmarkerInstance = HandLandmarker;
