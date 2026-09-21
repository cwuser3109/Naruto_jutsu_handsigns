import { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { PoseLandmarkerInstance } from '../types/mediapipes';

import { WASM_URL } from '../utils/mediapipeConfig';

interface UsePoseLandmarkerOptions {
  modelPath?: string;
  minDetectionConfidence?: number;
  minPresenceConfidence?: number;
  minTrackingConfidence?: number;
  numPoses?: number;
  runningMode?: 'VIDEO' | 'IMAGE';
}

// Safely close a landmarker without letting a failed close crash the app
function safeClose(instance: PoseLandmarkerInstance | null) {
  if (!instance) return;
  try {
    instance.close();
  } catch (e) {
    console.warn('Ignored error while closing pose landmarker:', e);
  }
}

export function usePoseLandmarker(options: UsePoseLandmarkerOptions = {}) {
  const [landmarker, setLandmarker] = useState<PoseLandmarkerInstance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const landmarkerRef = useRef<PoseLandmarkerInstance | null>(null);

  const {
    modelPath = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    minDetectionConfidence = 0.5,
    minPresenceConfidence = 0.5,
    minTrackingConfidence = 0.5,
    numPoses = 1,
    runningMode = 'VIDEO'
  } = options;

  useEffect(() => {
    let cancelled = false;

    const initializePose = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU'
          },
          runningMode,
          numPoses,
          minPoseDetectionConfidence: minDetectionConfidence,
          minPosePresenceConfidence: minPresenceConfidence,
          minTrackingConfidence: minTrackingConfidence,
          outputSegmentationMasks: false,
        });

        // If the effect was cleaned up while we were awaiting, throw this instance away
        if (cancelled) {
          safeClose(poseLandmarker);
          return;
        }

        landmarkerRef.current = poseLandmarker;
        setLandmarker(poseLandmarker);
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error('Failed to initialize pose landmarker');
        setError(error);
        console.error('Error initializing pose landmarker:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initializePose();

    return () => {
      cancelled = true;
      safeClose(landmarkerRef.current);
      landmarkerRef.current = null;
    };
  }, [modelPath, minDetectionConfidence, minPresenceConfidence, minTrackingConfidence, numPoses, runningMode]);

  return { landmarker, isLoading, error };
}