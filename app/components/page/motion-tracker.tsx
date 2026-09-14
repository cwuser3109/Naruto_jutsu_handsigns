import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MotionTrackerProps, PoseData, LandmarkPoint, HandData } from '../types/mediapipe';
import { usePoseLandmarker } from '../hooks/usePoseLandmarker';
import { useHandLandmarker } from '../hooks/useHandLandmarker';
import { extractPoseData, getPoseConnections } from '../utils/poseHelpers';
import { drawHandLandmarks, getHandConnections } from '../utils/handHelpers';

interface MotionTrackerState {
  isTracking: boolean;
  fps: number;
  error: string | null;
  handData: HandData | null;
}

const MotionTracker: React.FC<MotionTrackerProps> = ({
  onPoseUpdate,
  onLandmarksUpdate,
  onHandUpdate,
  onError,
  className = '',
  options = {}
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(Date.now());
  
  const [state, setState] = useState<MotionTrackerState>({
    isTracking: false,
    fps: 0,
    error: null,
    handData: null
  });

  const { landmarker: poseLandmarker, isLoading: poseLoading, error: poseError } = usePoseLandmarker(options);
  const { landmarker: handLandmarker, isLoading: handLoading, detectHands, error: handError } = useHandLandmarker({
    ...options,
    numHands: options.numPoses || 2
  });

  // Handle errors
  useEffect(() => {
    const error = poseError || handError;
    if (error) {
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }
  }, [poseError, handError, onError]);

  // Process each frame with both pose and hand tracking
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !state.isTracking) {
      return;
    }

    try {
      // Calculate FPS
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastTimeRef.current >= 1000) {
        setState(prev => ({ 
          ...prev, 
          fps: frameCountRef.current 
        }));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      const video = videoRef.current;
      let poseResults = null;
      let handResults = null;

      // Process pose tracking if available
      if (poseLandmarker) {
        poseResults = await poseLandmarker.detectForVideo(video, performance.now());
      }

      // Process hand tracking if available
      if (handLandmarker) {
        const handData = await detectHands(video);
        if (handData) {
          setState(prev => ({ ...prev, handData }));
          onHandUpdate?.(handData);
        }
      }

      // Draw results on canvas
      drawResults(poseResults, state.handData);

      // Callback with pose data
      if (poseResults?.landmarks && poseResults.landmarks.length > 0) {
        const landmarks = poseResults.landmarks[0] as LandmarkPoint[];
        const poseData = extractPoseData(landmarks);
        
        onPoseUpdate?.(poseData);
        onLandmarksUpdate?.(landmarks);
      }

      // Continue processing
      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error processing frame');
      console.error('Error processing frame:', error);
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }
  }, [poseLandmarker, handLandmarker, state.isTracking, detectHands, onPoseUpdate, onLandmarksUpdate, onHandUpdate, onError, state.handData]);

  // Draw results on canvas
  const drawResults = (poseResults: any, handData: HandData | null) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw pose landmarks
    if (poseResults?.landmarks && poseResults.landmarks.length > 0) {
      const landmarks = poseResults.landmarks[0];
      drawPoseConnections(ctx, landmarks, canvas.width, canvas.height);
      drawPoseLandmarks(ctx, landmarks, canvas.width, canvas.height);
    }

    // Draw hand landmarks
    if (handData && handData.landmarks.length > 0) {
      drawHandLandmarks(ctx, handData.landmarks, canvas.width, canvas.height, '#ff6bff');
      
      // Display gesture information
      drawGestureInfo(ctx, handData, canvas.width, canvas.height);
    }
  };

  // Draw pose connections
  const drawPoseConnections = (
    ctx: CanvasRenderingContext2D, 
    landmarks: any[], 
    canvasWidth: number, 
    canvasHeight: number
  ) => {
    const connections = getPoseConnections();

    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      
      if (start && end && start.visibility && end.visibility) {
        ctx.beginPath();
        ctx.moveTo(start.x * canvasWidth, start.y * canvasHeight);
        ctx.lineTo(end.x * canvasWidth, end.y * canvasHeight);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };

  // Draw pose landmarks
  const drawPoseLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    canvasWidth: number,
    canvasHeight: number
  ) => {
    landmarks.forEach((landmark: any) => {
      if (landmark.visibility && landmark.visibility > 0.5) {
        const x = landmark.x * canvasWidth;
        const y = landmark.y * canvasHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ff00';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  };

  // Draw gesture information
  const drawGestureInfo = (
    ctx: CanvasRenderingContext2D,
    handData: HandData,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const x = 10;
    const y = 30;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y - 20, 200, 80);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    ctx.fillText(`Hand: ${handData.handedness}`, x + 10, y);
    ctx.fillText(`Gesture: ${handData.gestures.gestureName}`, x + 10, y + 25);
    
    // Draw finger status indicators
    const fingerStatus = [
      { name: 'Thumb', extended: handData.fingers.thumb.isExtended },
      { name: 'Index', extended: handData.fingers.index.isExtended },
      { name: 'Middle', extended: handData.fingers.middle.isExtended },
      { name: 'Ring', extended: handData.fingers.ring.isExtended },
      { name: 'Pinky', extended: handData.fingers.pinky.isExtended }
    ];
    
    let xPos = x + 10;
    fingerStatus.forEach((finger) => {
      ctx.fillStyle = finger.extended ? '#00ff00' : '#ff0000';
      ctx.fillRect(xPos, y + 50, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.fillText(finger.name[0], xPos - 2, y + 62);
      xPos += 25;
    });
  };

  // ... (rest of the component remains the same)

  // Start video stream
  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState(prev => ({ ...prev, isTracking: true, error: null }));
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error accessing camera');
      console.error('Error accessing camera:', err);
      setState(prev => ({ ...prev, error: err.message }));
      onError?.(err);
    }
  }, [processFrame, onError]);

  // ... (rest of the component remains the same)

  return (
    <div className={`relative w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto"
          playsInline
          style={{ display: 'none' }}
        />
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
        />
        
        {/* Loading State */}
        {(poseLoading || handLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
              <p>Loading models...</p>
              <p className="text-sm text-gray-400">
                {poseLoading ? 'Loading pose model...' : 'Loading hand model...'}
              </p>
            </div>
          </div>
        )}
        
        {/* ... (rest of the UI remains the same) */}
      </div>
    </div>
  );
};

export default MotionTracker;