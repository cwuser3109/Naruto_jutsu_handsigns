"use client";
import React, { useState } from 'react';
import MotionTracker from './components/MotionTracker';
import type { HandInfo } from './components/types/mediapipes';

const MotionTrackingPage: React.FC = () => {
  const [hands, setHands] = useState<HandInfo[]>([]);
  const [seal, setSeal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Naruto Hand Seals
        </h1>

        <MotionTracker
          onHandUpdate={setHands}
          onSealDetected={setSeal}
          onError={(err) => setError(err.message)}
          options={{
            minDetectionConfidence: 0.5,
            minPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            numPoses: 1,
          }}
        />

        <div className="mt-8 bg-gray-800 rounded-lg p-4 text-gray-300">
          <h2 className="text-xl font-semibold text-white mb-4">Hand Data</h2>
          <p>Detected seal: <span className="text-green-400 font-bold">{seal ?? 'none'}</span></p>
          <p>Hands in view: {hands.length}</p>
          {hands.map((h, i) => (
            <p key={i} className="text-sm text-gray-400">
              Hand {i + 1}: {h.handedness} · {h.landmarks.length} landmarks · wrist x={h.landmarks[0].x.toFixed(2)}, y={h.landmarks[0].y.toFixed(2)}
            </p>
          ))}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default MotionTrackingPage;
