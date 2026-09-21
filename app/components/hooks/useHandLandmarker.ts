import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

import { WASM_URL } from '../utils/mediapipeConfig';

function safeClose(instance: HandLandmarker | null) {
  if (!instance) return;
  try {
    instance.close();
  } catch (e) {
    console.warn('Ignored error while closing hand landmarker:', e);
  }
}

interface UseHandLandmarkerOptions {
  modelPath?: string;
  minDetectionConfidence?: number;
  minPresenceConfidence?: number;
  minTrackingConfidence?: number;
  numHands?: number;
  runningMode?: 'VIDEO' | 'IMAGE';
}

export function useHandLandmarker(options: UseHandLandmarkerOptions = {}) {
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  const {
    modelPath = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    minDetectionConfidence = 0.5,
    minPresenceConfidence = 0.5,
    minTrackingConfidence = 0.5,
    numHands = 2,
    runningMode = 'VIDEO'
  } = options;

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
          runningMode,
          numHands,
          minHandDetectionConfidence: minDetectionConfidence,
          minHandPresenceConfidence: minPresenceConfidence,
          minTrackingConfidence: minTrackingConfidence,
        });

        if (cancelled) {
          safeClose(handLandmarker);
          return;
        }
        landmarkerRef.current = handLandmarker;
        setLandmarker(handLandmarker);
      } catch (err) {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error('Failed to init hand landmarker');
        setError(e);
        console.error('Error initializing hand landmarker:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      safeClose(landmarkerRef.current);
      landmarkerRef.current = null;
    };
  }, [modelPath, minDetectionConfidence, minPresenceConfidence, minTrackingConfidence, numHands, runningMode]);

  return { landmarker, isLoading, error };
}