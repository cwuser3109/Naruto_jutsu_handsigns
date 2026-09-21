"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PoseLandmarkerResult, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { usePoseLandmarker } from './hooks/usePoseLandmarker';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import { extractPoseData, getPoseConnections } from './utils/poseHelpers';
import {
  buildCandidates,
  buildSingleHandDescriptor,
  recognizeSign,
  nearestSign,
  SignTemplate,
  HAND_DESCRIPTOR_LENGTH,
  SIGN_DESCRIPTOR_LENGTH,
} from './utils/handHelpers';
import defaultSeals from './utils/defaultSeals.json';
import type { PoseData, LandmarkPoint, HandInfo } from './types/mediapipes';

interface MotionTrackerProps {
  onPoseUpdate?: (data: PoseData) => void;
  onLandmarksUpdate?: (landmarks: LandmarkPoint[]) => void;
  onHandUpdate?: (hands: HandInfo[]) => void;
  onSealDetected?: (seal: string | null) => void;
  onError?: (error: Error) => void;
  className?: string;
  options?: {
    minDetectionConfidence?: number;
    minPresenceConfidence?: number;
    minTrackingConfidence?: number;
    numPoses?: number;
  };
}

interface MotionTrackerState {
  isTracking: boolean;
  fps: number;
  error: string | null;
}

const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const SEALS = ['Tiger', 'Ram', 'Snake', 'Bird', 'Dog'];
const STORAGE_KEY = 'narutoSeals';
// Samples captured each time you press a record key (one per frame while a hand is visible)
const SAMPLES_PER_RECORDING = 10;
// Time to get into the pose after pressing a record key
const COUNTDOWN_MS = 3000;

// Only keep templates that match the current descriptor layout (drops stale/old-format data)
const isValidTemplate = (t: SignTemplate) =>
  !!t && typeof t.name === 'string' &&
  Array.isArray(t.descriptor) &&
  (t.descriptor.length === HAND_DESCRIPTOR_LENGTH || t.descriptor.length === SIGN_DESCRIPTOR_LENGTH);

const getDefaultSeals = () => (defaultSeals as SignTemplate[]).filter(isValidTemplate);

const MotionTracker: React.FC<MotionTrackerProps> = ({
  onPoseUpdate,
  onLandmarksUpdate,
  onHandUpdate,
  onSealDetected,
  onError,
  className = '',
  options = {}
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isTrackingRef = useRef<boolean>(false);

  const timestampRef = useRef<number>(0);
  const nextTimestamp = () => {
    timestampRef.current = Math.max(performance.now(), timestampRef.current + 1);
    return timestampRef.current;
  };

  const lastSealTimeRef = useRef<number>(0);
  const lastSealRef = useRef<string | null>(null);
  const templatesRef = useRef<SignTemplate[]>([]);
  // { name, remaining } while a recording burst is in progress
  const recordingRef = useRef<{ name: string; remaining: number; startAt: number } | null>(null);
  const [detectedSeal, setDetectedSeal] = useState<string>('none');
  const [closest, setClosest] = useState<string>('');
  const [recording, setRecording] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [state, setState] = useState<MotionTrackerState>({
    isTracking: false,
    fps: 0,
    error: null
  });

  const { landmarker: poseLandmarker, isLoading: poseLoading, error: poseError } = usePoseLandmarker(options);
  const { landmarker: handLandmarker, isLoading: handLoading, error: handError } = useHandLandmarker(options);
  const isLoading = poseLoading || handLoading;

  // The frame loop reads everything through refs so it never runs with stale closures
  const poseLandmarkerRef = useRef(poseLandmarker);
  const handLandmarkerRef = useRef(handLandmarker);
  const callbacksRef = useRef({ onPoseUpdate, onLandmarksUpdate, onHandUpdate, onSealDetected, onError });
  useEffect(() => {
    poseLandmarkerRef.current = poseLandmarker;
    handLandmarkerRef.current = handLandmarker;
    callbacksRef.current = { onPoseUpdate, onLandmarksUpdate, onHandUpdate, onSealDetected, onError };
  });

  const refreshCounts = () => {
    const c: Record<string, number> = {};
    for (const t of templatesRef.current) c[t.name] = (c[t.name] ?? 0) + 1;
    setCounts(c);
  };

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templatesRef.current));
    } catch (e) {
      console.warn('Could not save seals to localStorage:', e);
    }
  };

  // Load seals: localStorage first, otherwise the shipped defaultSeals.json
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        templatesRef.current = (JSON.parse(saved) as SignTemplate[]).filter(isValidTemplate);
        console.log(`Loaded ${templatesRef.current.length} templates from localStorage`);
      } else {
        templatesRef.current = getDefaultSeals();
        console.log(`Loaded ${templatesRef.current.length} templates from defaultSeals.json`);
      }
    } catch (e) {
      console.warn('Could not load seals, using defaults:', e);
      templatesRef.current = getDefaultSeals();
    }
    // Syncing from an external system (localStorage) on mount; can't be read during SSR
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCounts();
  }, []);

  const startRecording = useCallback((name: string) => {
    recordingRef.current = { name, remaining: SAMPLES_PER_RECORDING, startAt: performance.now() + COUNTDOWN_MS };
    setRecording(`${name} — get ready…`);
  }, []);

  const clearAll = useCallback(() => {
    templatesRef.current = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setDetectedSeal('none');
    refreshCounts();
  }, []);

  const resetToDefaults = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    templatesRef.current = getDefaultSeals();
    refreshCounts();
    setDetectedSeal('none');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '0') { clearAll(); return; }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < SEALS.length) startRecording(SEALS[idx]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearAll, startRecording]);

  const modelError = poseError || handError;
  useEffect(() => {
    if (modelError) onError?.(modelError);
  }, [modelError, onError]);

  const setSeal = (seal: string | null) => {
    if (lastSealRef.current !== seal) {
      lastSealRef.current = seal;
      callbacksRef.current.onSealDetected?.(seal);
    }
  };

  const processHands = (handResults: HandLandmarkerResult | null) => {
    const handCount = handResults?.landmarks?.length ?? 0;

    if (!handResults || handCount === 0) {
      if (Date.now() - lastSealTimeRef.current > 400) {
        setDetectedSeal('no hands');
        setClosest('');
        setSeal(null);
      }
      callbacksRef.current.onHandUpdate?.([]);
      return;
    }

    const hands: HandInfo[] = handResults.landmarks.map((lm, i) => ({
      landmarks: lm as LandmarkPoint[],
      handedness: (handResults.handednesses[i]?.[0]?.categoryName ?? 'Right') as 'Left' | 'Right',
    }));
    callbacksRef.current.onHandUpdate?.(hands);

    const rec = recordingRef.current;
    if (rec) {
      const wait = rec.startAt - performance.now();
      if (wait > 0) {
        setRecording(`${rec.name} — starting in ${Math.ceil(wait / 1000)}…`);
      } else {
        // Recording stores ONE hand, so the other hand stays free to press keys
        templatesRef.current.push({ name: rec.name, descriptor: buildSingleHandDescriptor(hands[0]) });
        rec.remaining--;
        const done = SAMPLES_PER_RECORDING - rec.remaining;
        if (rec.remaining <= 0) {
          recordingRef.current = null;
          persist();
          refreshCounts();
          setRecording('');
          console.log(`Saved ${SAMPLES_PER_RECORDING} samples of ${rec.name} — total: ${templatesRef.current.length}`);
        } else {
          setRecording(`${rec.name} ${done}/${SAMPLES_PER_RECORDING}`);
        }
      }
    }

    const candidates = buildCandidates(hands);
    const near = nearestSign(candidates, templatesRef.current);
    setClosest(near ? `closest: ${near.name} (dist ${near.distance.toFixed(2)})` : '');

    const result = recognizeSign(candidates, templatesRef.current);
    if (result) {
      setDetectedSeal(`${result.name} (${(result.confidence * 100).toFixed(0)}%)`);
      lastSealTimeRef.current = Date.now();
      setSeal(result.name);
    } else if (Date.now() - lastSealTimeRef.current > 400) {
      setDetectedSeal(templatesRef.current.length ? 'none (no match)' : 'none (no seals recorded)');
      setSeal(null);
    }
  };

  const draw = (poseResults: PoseLandmarkerResult | null, handResults: HandLandmarkerResult | null) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const video = videoRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    drawPose(ctx, poseResults, canvas.width, canvas.height);
    drawHands(ctx, handResults, canvas.width, canvas.height);
  };

  const drawPose = (ctx: CanvasRenderingContext2D, results: PoseLandmarkerResult | null, w: number, h: number) => {
    if (!results?.landmarks || results.landmarks.length === 0) return;
    const landmarks = results.landmarks[0];

    getPoseConnections().forEach(([a, b]) => {
      const s = landmarks[a], e = landmarks[b];
      if (s && e && s.visibility && e.visibility) {
        ctx.beginPath();
        ctx.moveTo(s.x * w, s.y * h);
        ctx.lineTo(e.x * w, e.y * h);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    landmarks.forEach(lm => {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#00ff00';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  };

  const drawHands = (ctx: CanvasRenderingContext2D, results: HandLandmarkerResult | null, w: number, h: number) => {
    if (!results?.landmarks || results.landmarks.length === 0) return;

    results.landmarks.forEach(hand => {
      HAND_CONNECTIONS.forEach(([a, b]) => {
        const s = hand[a], e = hand[b];
        if (s && e) {
          ctx.beginPath();
          ctx.moveTo(s.x * w, s.y * h);
          ctx.lineTo(e.x * w, e.y * h);
          ctx.strokeStyle = '#ff9900';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
      hand.forEach(lm => {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffff00';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  };

  const processFrame = () => {
    if (!isTrackingRef.current) return;
    const video = videoRef.current;
    const pose = poseLandmarkerRef.current;
    const hand = handLandmarkerRef.current;

    try {
      frameCountRef.current++;
      const t = nextTimestamp();
      if (t - lastTimeRef.current >= 1000) {
        setState(prev => ({ ...prev, fps: frameCountRef.current }));
        frameCountRef.current = 0;
        lastTimeRef.current = t;
      }

      // Models may still be loading or the video not ready yet: keep the loop alive
      if (!video || (!pose && !hand) || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const poseResults = pose ? pose.detectForVideo(video, t) : null;
      const handResults = hand ? hand.detectForVideo(video, t) : null;

      draw(poseResults, handResults);
      processHands(handResults);

      if (poseResults?.landmarks && poseResults.landmarks.length > 0) {
        const landmarks = poseResults.landmarks[0] as LandmarkPoint[];
        callbacksRef.current.onPoseUpdate?.(extractPoseData(landmarks));
        callbacksRef.current.onLandmarksUpdate?.(landmarks);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error processing frame');
      console.error('Error processing frame:', error);
      setState(prev => ({ ...prev, error: error.message }));
      callbacksRef.current.onError?.(error);
    }
  };

  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      let started = false;
      const begin = () => {
        if (started) return;
        started = true;
        isTrackingRef.current = true;
        setState(prev => ({ ...prev, isTracking: true, error: null }));
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      video.onloadeddata = () => {
        video.play().then(begin).catch(() => begin());
      };

      await video.play().catch(() => {});
      if (video.readyState >= 2) begin();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error accessing camera');
      let message = err.message;
      if (err.name === 'NotReadableError') message = 'Camera is in use by another app. Close it and try again.';
      else if (err.name === 'NotAllowedError') message = 'Camera permission denied. Allow access and reload.';
      else if (err.name === 'NotFoundError') message = 'No camera found.';
      console.error('Error accessing camera:', err);
      setState(prev => ({ ...prev, error: message }));
      callbacksRef.current.onError?.(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopVideo = useCallback(() => {
    isTrackingRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      stopVideo();
    };
  }, [stopVideo]);

  const exportSeals = () => {
    const data = JSON.stringify(templatesRef.current, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'defaultSeals.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className={`relative w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        <canvas ref={canvasRef} className="w-full h-auto min-h-64" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
              <p>Loading models...</p>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="bg-black/50 text-white px-3 py-1 rounded-lg text-sm">FPS: {state.fps}</div>
          <div className="bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
            Status: {state.isTracking ? '🟢 Tracking' : '⏸️ Paused'}
          </div>
        </div>

        {(state.error || modelError) && (
          <div className="absolute top-16 left-4 right-4 bg-red-500/90 text-white px-3 py-2 rounded-lg text-sm pointer-events-none">
            ⚠️ {state.error ?? modelError?.message}
          </div>
        )}

        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-lg pointer-events-none text-center whitespace-nowrap">
          <div>Seal: {detectedSeal}</div>
          {closest && <div className="text-xs text-gray-300">{closest}</div>}
          {recording && <div className="text-sm text-yellow-300">⏺ Recording {recording}</div>}
        </div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {!state.isTracking ? (
            <button
              onClick={startVideo}
              disabled={isLoading}
              className={`px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Start Tracking
            </button>
          ) : (
            <button
              onClick={stopVideo}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
            >
              Stop Tracking
            </button>
          )}
        </div>
      </div>

      {/* Recording / export panel */}
      <div className="mt-4 bg-gray-800 rounded-lg p-4 text-gray-200">
        <h3 className="font-semibold text-white mb-2">Record seals</h3>
        <p className="text-sm text-gray-400 mb-3">
          Start tracking, press a seal key (or click it), then you get {COUNTDOWN_MS / 1000}s to make the seal
          with ONE hand in view (the other hand can press keys). Each press saves {SAMPLES_PER_RECORDING} samples. Record each seal 3–5 times, varying distance and angle slightly.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {SEALS.map((name, i) => (
            <button
              key={name}
              onClick={() => startRecording(name)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
            >
              {i + 1} · {name} ({counts[name] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportSeals} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm">
            Export Seals (defaultSeals.json)
          </button>
          <button onClick={resetToDefaults} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm">
            Reset to shipped seals
          </button>
          <button onClick={clearAll} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm">
            Clear all (0)
          </button>
        </div>
      </div>
    </div>
  );
};

export default MotionTracker;
