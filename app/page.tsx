"use client";
import React, { useState } from 'react';
import MotionTracker from './components/MotionTracker';
// import ( PoseData, LandmarkPoint) from './components/types/mediapipes';


interface TrackingData {
  poseData: PoseData | null;
  landmarks: LandmarkPoint[] | null;
  error: string | null;
}

const MotionTrackingPage: React.FC = () => {
  const [trackingData, setTrackingData] = useState<TrackingData>({
    poseData: null,
    landmarks: null,
    error: null
  });

  const handlePoseUpdate = (data: PoseData) => {
    setTrackingData(prev => ({ ...prev, poseData: data }));
  };

  const handleLandmarksUpdate = (landmarks: LandmarkPoint[]) => {
    setTrackingData(prev => ({ ...prev, landmarks }));
  };

  const handleError = (error: Error) => {
    setTrackingData(prev => ({ ...prev, error: error.message }));
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Motion Tracking Demo
        </h1>
        
        <MotionTracker
          onPoseUpdate={handlePoseUpdate}
          onLandmarksUpdate={handleLandmarksUpdate}
          onError={handleError}
          options={{
            minDetectionConfidence: 0.5,
            minPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            numPoses: 1
          }}
        />

        {/* Display Pose Data */}
        {trackingData.poseData && (
          <div className="mt-8 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-4">
              Pose Data
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
              <div>
                <h3 className="font-medium text-white mb-2">Angles</h3>
                <div className="space-y-1">
                  <p>Left Elbow: {trackingData.poseData.angles.leftElbow.toFixed(1)}°</p>
                  <p>Right Elbow: {trackingData.poseData.angles.rightElbow.toFixed(1)}°</p>
                  <p>Left Knee: {trackingData.poseData.angles.leftKnee.toFixed(1)}°</p>
                  <p>Right Knee: {trackingData.poseData.angles.rightKnee.toFixed(1)}°</p>
                  <p>Left Shoulder: {trackingData.poseData.angles.leftShoulder.toFixed(1)}°</p>
                  <p>Right Shoulder: {trackingData.poseData.angles.rightShoulder.toFixed(1)}°</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">Metrics</h3>
                <div className="space-y-1">
                  <p>Shoulder Width: {trackingData.poseData.metrics.shoulderWidth.toFixed(3)}</p>
                  <p>Hip Width: {trackingData.poseData.metrics.hipWidth.toFixed(3)}</p>
                  <p>Torso Height: {trackingData.poseData.metrics.torsoHeight.toFixed(3)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 text-gray-400 text-sm">
              <p>Total Landmarks: {trackingData.poseData.landmarks.length}</p>
              <p>Last Update: {new Date(trackingData.poseData.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {trackingData.error && (
          <div className="mt-4 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            <strong>Error:</strong> {trackingData.error}
          </div>
        )}
      </div>
    </div>
  );
};

export default MotionTrackingPage;