import React, { useState } from 'react';
import MotionTracker from '../components/MotionTracker';
import { PoseData, HandData } from '../types/mediapipe';

const HandTrackingDemo: React.FC = () => {
  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [handData, setHandData] = useState<HandData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePoseUpdate = (data: PoseData) => {
    setPoseData(data);
  };

  const handleHandUpdate = (data: HandData) => {
    setHandData(data);
    console.log('Hand gesture:', data.gestures.gestureName);
    console.log('Finger states:', {
      thumb: data.fingers.thumb.isExtended ? '✋' : '👊',
      index: data.fingers.index.isExtended ? '✋' : '👊',
      middle: data.fingers.middle.isExtended ? '✋' : '👊',
      ring: data.fingers.ring.isExtended ? '✋' : '👊',
      pinky: data.fingers.pinky.isExtended ? '✋' : '👊',
    });
  };

  const handleError = (err: Error) => {
    setError(err.message);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Hand & Pose Tracking Demo
        </h1>
        
        <MotionTracker
          onPoseUpdate={handlePoseUpdate}
          onHandUpdate={handleHandUpdate}
          onError={handleError}
          options={{
            minDetectionConfidence: 0.5,
            minPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            numPoses: 1,
            enableHandTracking: true
          }}
        />

        {/* Display Hand Data */}
        {handData && (
          <div className="mt-8 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Hand Tracking Data
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-gray-300">
                <h3 className="font-medium text-white mb-2">Hand Information</h3>
                <p>Handedness: {handData.handedness}</p>
                <p>Gesture: <span className="text-green-400 font-bold">{handData.gestures.gestureName}</span></p>
                <p>Landmarks: {handData.landmarks.length}</p>
              </div>
              
              <div className="text-gray-300">
                <h3 className="font-medium text-white mb-2">Finger States</h3>
                <div className="space-y-1">
                  <p>Thumb: {handData.fingers.thumb.isExtended ? '🟢 Extended' : '🔴 Folded'}</p>
                  <p>Index: {handData.fingers.index.isExtended ? '🟢 Extended' : '🔴 Folded'}</p>
                  <p>Middle: {handData.fingers.middle.isExtended ? '🟢 Extended' : '🔴 Folded'}</p>
                  <p>Ring: {handData.fingers.ring.isExtended ? '🟢 Extended' : '🔴 Folded'}</p>
                  <p>Pinky: {handData.fingers.pinky.isExtended ? '🟢 Extended' : '🔴 Folded'}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <h3 className="font-medium text-white mb-2">Gesture Detection</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className={`p-2 rounded ${handData.gestures.isOpen ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
                  Open Hand {handData.gestures.isOpen ? '✅' : '❌'}
                </div>
                <div className={`p-2 rounded ${handData.gestures.isFist ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
                  Fist {handData.gestures.isFist ? '✅' : '❌'}
                </div>
                <div className={`p-2 rounded ${handData.gestures.isPeace ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
                  Peace {handData.gestures.isPeace ? '✅' : '❌'}
                </div>
                <div className={`p-2 rounded ${handData.gestures.isThumbsUp ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
                  Thumbs Up {handData.gestures.isThumbsUp ? '✅' : '❌'}
                </div>
                <div className={`p-2 rounded ${handData.gestures.isPointing ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700/50'}`}>
                  Pointing {handData.gestures.isPointing ? '✅' : '❌'}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default HandTrackingDemo;