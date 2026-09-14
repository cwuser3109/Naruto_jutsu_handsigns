import { PoseLandmarker, PoseLandmarkerResult, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

// ... existing types ...

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandData {
  timestamp: number;
  landmarks: HandLandmarkPoint[];
  handedness: 'Left' | 'Right' | 'Unknown';
  fingers: FingerPositions;
  gestures: HandGestures;
}

export interface FingerPositions {
  thumb: FingerState;
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
}

export interface FingerState {
  isExtended: boolean;
  tip: HandLandmarkPoint;
  dip: HandLandmarkPoint;
  pip: HandLandmarkPoint;
  mcp: HandLandmarkPoint;
  angle: number;
}

export interface HandGestures {
  isOpen: boolean;
  isFist: boolean;
  isPeace: boolean;
  isThumbsUp: boolean;
  isPointing: boolean;
  gestureName: string;
}

export interface MotionTrackerProps {
  onPoseUpdate?: (data: PoseData) => void;
  onLandmarksUpdate?: (landmarks: LandmarkPoint[]) => void;
  onHandUpdate?: (handData: HandData) => void;
  onError?: (error: Error) => void;
  className?: string;
  options?: {
    modelPath?: string;
    minDetectionConfidence?: number;
    minPresenceConfidence?: number;
    minTrackingConfidence?: number;
    numPoses?: number;
    runningMode?: 'VIDEO' | 'IMAGE';
    enableHandTracking?: boolean;
  };
}

export type HandLandmarkerInstance = HandLandmarker;
export type HandResult = HandLandmarkerResult;