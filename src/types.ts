export type AspectRatio = '9:16' | '16:9';
export type VideoResolution = '720p' | '1080p';
export type VeoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-lite-generate-preview' | 'veo-3.1-generate-preview';

export type TimeOfDay = 'golden_hour' | 'blue_hour' | 'gothic_night' | 'misty_dawn';
export type WeatherEffect = 'clear' | 'scottish_rain' | 'sea_mist' | 'amber_leaves';

export interface CityPreset {
  id: string;
  name: string;
  landmark: string;
  badge: string;
  imageSrc: string;
  horizonRatio: number; // 0.0 to 1.0 vertical position of vanishing point
  timeOfDay: TimeOfDay;
  weather: WeatherEffect;
  prompt: string;
  description: string;
}

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
  presetName?: string;
}

export interface MotionLayerSettings {
  traffic: boolean;
  pedestrians: boolean;
  cloudDrift: boolean;
  streetLights: boolean;
  cameraPushIn: boolean;
  clockLuminescence: boolean;
  weather: boolean;
  vectorOverlay: boolean;
}
