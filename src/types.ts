export type AspectRatio = '9:16' | '16:9';
export type VideoResolution = '720p' | '1080p';
export type VeoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-lite-generate-preview' | 'veo-3.1-generate-preview';

export interface GenerationConfig {
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: VideoResolution;
  prompt: string;
}

export interface VideoHistoryItem {
  id: string;
  operationName?: string;
  videoUrl: string;
  thumbnailUrl: string;
  prompt: string;
  aspectRatio: AspectRatio;
  model: string;
  createdAt: number;
  durationSeconds: number;
}

export interface MotionLayerSettings {
  traffic: boolean;
  pedestrians: boolean;
  cloudDrift: boolean;
  streetLights: boolean;
  cameraPushIn: boolean;
  clockLuminescence: boolean;
}
