"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePoseLandmarker } from './hooks/usePoseLandmarker';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import { extractPoseData, getPoseConnections } from './utils/poseHelpers';
import { buildSignDescriptor, recognizeSign, SignTemplate } from './utils/handHelpers';
import defaultSeals from './utils/defaultSeals.json';

interface MotionTrackerProps {
  onPoseUpdate?: (data: any) => void;
  onLandmarksUpdate?: (landmarks: any[]) => void;
  onError?: (error: Error) => void;
  className?: string;
  options?: any;
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

const MotionTracker: React.FC<MotionTrackerProps> = ({
  onPoseUpdate,
  onLandmarksUpdate,
  onError,
  className = '',
  options = {}
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(Date.now());
  const isTrackingRef = useRef<boolean>(false);

  const timestampRef = useRef<number>(0);
  const nextTimestamp = () => {
    const now = performance.now();
    timestampRef.current = Math.max(now, timestampRef.current + 1);
    return timestampRef.current;
  };

  const lastSealTimeRef = useRef<number>(0);
  const templatesRef = useRef<SignTemplate[]>([]);
  const recordNameRef = useRef<string | null>(null);
  const [detectedSeal, setDetectedSeal] = useState<string>('none');
  const [templateCount, setTemplateCount] = useState<number>(0);

  const [state, setState] = useState<MotionTrackerState>({
    isTracking: false,
    fps: 0,
    error: null
  });

  const { landmarker: poseLandmarker, isLoading: poseLoading, error: poseError } = usePoseLandmarker(options);
  const { landmarker: handLandmarker, isLoading: handLoading, error: handError } = useHandLandmarker(options);
  const isLoading = poseLoading || handLoading;

  // Load seals: localStorage first, otherwise the shipped defaultSeals.json
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        templatesRef.current = JSON.parse(saved);
        console.log(`Loaded ${templatesRef.current.length} templates from localStorage`);
      } else {
        templatesRef.current = defaultSeals as SignTemplate[];
        console.log(`Loaded ${templatesRef.current.length} templates from defaultSeals.json`);
      }
      setTemplateCount(templatesRef.current.length);
    } catch (e) {
      console.warn('Could not load seals:', e);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '0') {
        templatesRef.current = [];
        localStorage.removeItem(STORAGE_KEY);
        setTemplateCount(0);
        setDetectedSeal('none');
        console.log('Cleared all seals');
        return;
      }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < SEALS.length) recordNameRef.current = SEALS[idx];
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const err = poseError || handError;
    if (err) {
      setState(prev => ({ ...prev, error: err.message }));
      onError?.(err);
    }
  }, [poseError, handError, onError]);

  const processFrame = useCallback(async () => {
    if (!poseLandmarker || !videoRef.current || !isTrackingRef.current) return;

    try {
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastTimeRef.current >= 1000) {
        setState(prev => ({ ...prev, fps: frameCountRef.current }));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      const video = videoRef.current;

      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const t = nextTimestamp();
      const poseResults = poseLandmarker.detectForVideo(video, t);
      const handResults = handLandmarker
        ? handLandmarker.detectForVideo(video, t + 1000)
        : null;

      draw(poseResults, handResults);

      // ===== Seal recognition with visible debug states =====
      const handCount = handResults?.landmarks?.length ?? 0;

      if (handCount > 0) {
        const hands = handResults!.landmarks.map((lm: any, i: number) => ({
          landmarks: lm,
          handedness: handResults!.handednesses[i][0].categoryName as 'Left' | 'Right',
        }));

        const descriptor = buildSignDescriptor(hands);

        if (descriptor) {
          if (recordNameRef.current) {
            templatesRef.current.push({ name: recordNameRef.current, descriptor });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(templatesRef.current));
            setTemplateCount(templatesRef.current.length);
            console.log(`Saved ${recordNameRef.current} — total: ${templatesRef.current.length}`);
            recordNameRef.current = null;
          }
          const result = recognizeSign(descriptor, templatesRef.current);
          if (result) {
            setDetectedSeal(`${result.name} (${(result.confidence * 100).toFixed(0)}%)`);
            lastSealTimeRef.current = Date.now();
          } else if (Date.now() - lastSealTimeRef.current > 400) {
            setDetectedSeal('none (no match)');
          }
        } else if (Date.now() - lastSealTimeRef.current > 400) {
          setDetectedSeal(`need 2 hands (see ${handCount})`);
        }
      } else if (Date.now() - lastSealTimeRef.current > 400) {
        setDetectedSeal('no hands');
      }
      // =====================================================

      if (poseResults.landmarks && poseResults.landmarks.length > 0) {
        const landmarks = poseResults.landmarks[0];
        const poseData = extractPoseData(landmarks as any);
        onPoseUpdate?.(poseData);
        onLandmarksUpdate?.(landmarks);
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error processing frame');
      console.error('Error processing frame:', error);
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseLandmarker, handLandmarker, onPoseUpdate, onLandmarksUpdate, onError]);

  const draw = (poseResults: any, handResults: any) => {
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

  const drawPose = (ctx: CanvasRenderingContext2D, results: any, w: number, h: number) => {
    if (!results?.landmarks || results.landmarks.length === 0) return;
    const landmarks = results.landmarks[0];

    getPoseConnections().forEach(([a, b]: [number, number]) => {
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

    landmarks.forEach((lm: any) => {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#00ff00';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  };

  const drawHands = (ctx: CanvasRenderingContext2D, results: any, w: number, h: number) => {
    if (!results?.landmarks || results.landmarks.length === 0) return;

    results.landmarks.forEach((hand: any[]) => {
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
      hand.forEach((lm: any) => {
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

  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      const begin = () => {
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
      onError?.(err);
    }
  }, [processFrame, onError]);

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
        <canvas ref={canvasRef} className="w-full h-auto" />

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

        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-lg pointer-events-none text-center">
          <div>Seal: {detectedSeal}</div>
          <div className="text-xs text-gray-300 mt-1">
            Templates: {templateCount} · Keys 1-5 record · 0 clears
          </div>
        </div>

        {state.error && (
          <div className="absolute top-16 left-4 right-4 bg-red-500/90 text-white px-3 py-2 rounded-lg text-sm pointer-events-none">
            ⚠️ {state.error}
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 space-x-2">
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

          <button
            onClick={() => {
              const data = JSON.stringify(templatesRef.current, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'defaultSeals.json';
              a.click();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Export Seals
          </button>
        </div>
      </div>
    </div>
  );
};

export default MotionTracker;