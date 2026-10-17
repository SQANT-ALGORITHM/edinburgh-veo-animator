import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Eye,
  Layers,
  Sparkles,
  SplitSquareVertical,
  Camera,
  Sun,
  Moon,
  CloudRain,
  Wind,
  Bell,
  Compass,
} from 'lucide-react';
import { cityAudio } from '../utils/audio';
import { MotionLayerSettings, TimeOfDay, WeatherEffect } from '../types';

interface LivingCanvasProps {
  imageSrc: string;
  isCustomImage?: boolean;
  timeOfDay?: TimeOfDay;
  weather?: WeatherEffect;
  onTimeOfDayChange?: (tod: TimeOfDay) => void;
  onWeatherChange?: (w: WeatherEffect) => void;
}

interface Vehicle {
  id: number;
  lane: 'northbound' | 'southbound';
  laneOffset: number;
  progress: number;
  speed: number;
  type: 'bus' | 'car' | 'cab';
  color: string;
  lightIntensity: number;
}

interface Pedestrian {
  id: number;
  side: 'left' | 'right';
  progress: number;
  direction: 1 | -1;
  speed: number;
  color: string;
  size: number;
}

interface WeatherParticle {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  size: number;
  alpha: number;
  rotation?: number;
  rotationSpeed?: number;
}

export const LivingCanvas: React.FC<LivingCanvasProps> = ({
  imageSrc,
  isCustomImage = false,
  timeOfDay: controlledTimeOfDay,
  weather: controlledWeather,
  onTimeOfDayChange,
  onWeatherChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.4);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compareMode, setCompareMode] = useState<'live' | 'split' | 'static'>('live');
  const [splitPosition, setSplitPosition] = useState(50);
  const [showWireframe, setShowWireframe] = useState(false);

  // Environmental Controls
  const [localTimeOfDay, setLocalTimeOfDay] = useState<TimeOfDay>('golden_hour');
  const [localWeather, setLocalWeather] = useState<WeatherEffect>('clear');

  const activeTimeOfDay = controlledTimeOfDay || localTimeOfDay;
  const activeWeather = controlledWeather || localWeather;

  const setTimeOfDay = (tod: TimeOfDay) => {
    setLocalTimeOfDay(tod);
    onTimeOfDayChange?.(tod);
  };

  const setWeather = (w: WeatherEffect) => {
    setLocalWeather(w);
    onWeatherChange?.(w);
  };

  // Motion layers
  const [layers, setLayers] = useState<MotionLayerSettings>({
    traffic: true,
    pedestrians: true,
    cloudDrift: true,
    streetLights: true,
    cameraPushIn: true,
    clockLuminescence: true,
    weather: true,
    vectorOverlay: false,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [clockChimed, setClockChimed] = useState(false);

  // Simulation state
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const simulationTimeRef = useRef<number>(0);

  // Vehicles, Pedestrians, Weather pools
  const vehiclesRef = useRef<Vehicle[]>([]);
  const pedestriansRef = useRef<Pedestrian[]>([]);
  const weatherParticlesRef = useRef<WeatherParticle[]>([]);

  // Initialize vehicles for Princes Street
  useEffect(() => {
    const vehicles: Vehicle[] = [
      { id: 1, lane: 'southbound', laneOffset: -0.25, progress: 0.88, speed: 0.024, type: 'bus', color: '#881337', lightIntensity: 1.0 },
      { id: 2, lane: 'southbound', laneOffset: 0.28, progress: 0.72, speed: 0.026, type: 'bus', color: '#9f1239', lightIntensity: 0.95 },
      { id: 3, lane: 'southbound', laneOffset: -0.15, progress: 0.52, speed: 0.028, type: 'bus', color: '#881337', lightIntensity: 0.9 },
      { id: 4, lane: 'northbound', laneOffset: 0.35, progress: 0.65, speed: 0.029, type: 'bus', color: '#9f1239', lightIntensity: 0.85 },
      { id: 5, lane: 'southbound', laneOffset: 0.12, progress: 0.94, speed: 0.038, type: 'cab', color: '#111827', lightIntensity: 1.0 },
      { id: 6, lane: 'southbound', laneOffset: -0.32, progress: 0.42, speed: 0.035, type: 'car', color: '#b91c1c', lightIntensity: 0.8 },
      { id: 7, lane: 'northbound', laneOffset: 0.18, progress: 0.35, speed: 0.032, type: 'car', color: '#cbd5e1', lightIntensity: 0.75 },
      { id: 8, lane: 'southbound', laneOffset: 0.05, progress: 0.22, speed: 0.031, type: 'car', color: '#334155', lightIntensity: 0.7 },
      { id: 9, lane: 'northbound', laneOffset: -0.1, progress: 0.15, speed: 0.03, type: 'car', color: '#ea580c', lightIntensity: 0.65 },
      { id: 10, lane: 'southbound', laneOffset: 0.22, progress: 0.08, speed: 0.032, type: 'car', color: '#475569', lightIntensity: 0.6 },
    ];
    vehiclesRef.current = vehicles;

    // Pedestrians
    const pedestrians: Pedestrian[] = [];
    for (let i = 0; i < 45; i++) {
      pedestrians.push({
        id: i,
        side: i % 2 === 0 ? 'left' : 'right',
        progress: Math.random(),
        direction: Math.random() > 0.5 ? 1 : -1,
        speed: 0.008 + Math.random() * 0.012,
        color: ['#1e293b', '#334155', '#475569', '#7f1d1d', '#9a3412', '#0f172a'][i % 6],
        size: 0.7 + Math.random() * 0.6,
      });
    }
    pedestriansRef.current = pedestrians;

    // Weather particles
    const particles: WeatherParticle[] = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * 720,
        y: Math.random() * 1280,
        speedX: -1 + Math.random() * 2,
        speedY: 2 + Math.random() * 8,
        size: 1 + Math.random() * 3,
        alpha: 0.2 + Math.random() * 0.6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.05 + Math.random() * 0.1,
      });
    }
    weatherParticlesRef.current = particles;
  }, []);

  // Load image
  useEffect(() => {
    setImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      baseImageRef.current = img;
      setImageLoaded(true);
    };
  }, [imageSrc]);

  // Audio toggle
  const toggleAudio = () => {
    if (isMuted) {
      cityAudio.start();
      cityAudio.setVolume(volume);
      setIsMuted(false);
    } else {
      cityAudio.stop();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    cityAudio.setVolume(val);
  };

  const handleTriggerClockChime = () => {
    cityAudio.chimeClock();
    setClockChimed(true);
    setTimeout(() => setClockChimed(false), 2800);
  };

  // Main rendering loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseImg = baseImageRef.current;
    if (!baseImg) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const t = simulationTimeRef.current;
    const loopDuration = 15.0;
    const normalizedLoop = (t % loopDuration) / loopDuration;

    // 1. Camera Zoom Calculation (Subtle elevated push-in from 1.000 to 1.045)
    let zoom = 1.0;
    if (layers.cameraPushIn && compareMode !== 'static') {
      zoom = 1.0 + 0.045 * Math.sin((normalizedLoop * Math.PI) / 2);
    }

    ctx.save();

    // Camera transform: centered slightly above Princes Street vanishing point
    const focalX = w * 0.52;
    const focalY = h * 0.56;
    ctx.translate(focalX, focalY);
    ctx.scale(zoom, zoom);
    ctx.translate(-focalX, -focalY);

    // 2. Draw Base Static Photograph
    ctx.drawImage(baseImg, 0, 0, w, h);

    // If static only, finish drawing and restore
    if (compareMode === 'static') {
      ctx.restore();
      return;
    }

    // Set clipping for Split Comparison mode
    if (compareMode === 'split') {
      const splitX = (splitPosition / 100) * w;
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
    }

    // 3. Environmental Atmosphere & Time of Day Tint
    if (activeTimeOfDay !== 'golden_hour') {
      ctx.save();
      if (activeTimeOfDay === 'blue_hour') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(30, 58, 138, 0.15)';
        ctx.fillRect(0, 0, w, h * 0.6);
      } else if (activeTimeOfDay === 'gothic_night') {
        ctx.fillStyle = 'rgba(5, 5, 10, 0.42)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
        ctx.fillRect(0, 0, w, h * 0.7);
      } else if (activeTimeOfDay === 'misty_dawn') {
        ctx.fillStyle = 'rgba(238, 242, 255, 0.14)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.08)';
        ctx.fillRect(0, 0, w, h * 0.45);
      }
      ctx.restore();
    }

    // 4. SKY & CLOUDS DRIFT LAYER (y: 0 to 0.42 * h)
    if (layers.cloudDrift) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h * 0.42);
      ctx.clip();

      const cloudDriftOffset1 = (t * 8) % w;
      const cloudDriftOffset2 = (t * 4) % w;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      const sunsetPulse = 0.06 * Math.sin(t * 0.4);

      if (activeTimeOfDay === 'blue_hour' || activeTimeOfDay === 'gothic_night') {
        skyGrad.addColorStop(0, 'rgba(10, 15, 30, 0.15)');
        skyGrad.addColorStop(0.5, 'rgba(30, 58, 138, 0.18)');
        skyGrad.addColorStop(1, 'rgba(217, 119, 6, 0.08)');
      } else {
        skyGrad.addColorStop(0, 'rgba(30, 20, 35, 0.08)');
        skyGrad.addColorStop(0.5, `rgba(249, 115, 22, ${0.07 + sunsetPulse})`);
        skyGrad.addColorStop(0.85, `rgba(251, 146, 60, ${0.1 + sunsetPulse * 1.2})`);
        skyGrad.addColorStop(1, 'rgba(217, 119, 6, 0.05)');
      }

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.42);

      // Wispy cloud drift bands
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = activeTimeOfDay === 'gothic_night' ? 'rgba(147, 197, 253, 0.03)' : 'rgba(253, 186, 116, 0.035)';
      for (let i = 0; i < 4; i++) {
        const cy = h * (0.08 + i * 0.08);
        const cx = ((cloudDriftOffset1 * (1 + i * 0.3) + i * 180) % (w * 1.5)) - w * 0.25;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 260, 42, 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. BALMORAL CLOCK TOWER ILLUMINATION & CHIME PULSE
    if (layers.clockLuminescence) {
      ctx.save();
      const clockX = w * 0.185;
      const clockY = h * 0.265;
      const clockRadius = w * 0.042;

      let glowIntensity = 0.24 + 0.06 * Math.sin(t * 1.2);
      if (clockChimed) {
        glowIntensity += 0.4;
      }

      const clockGrad = ctx.createRadialGradient(
        clockX, clockY, clockRadius * 0.2,
        clockX, clockY, clockRadius * (clockChimed ? 4.5 : 2.8)
      );
      clockGrad.addColorStop(0, `rgba(254, 240, 138, ${glowIntensity})`);
      clockGrad.addColorStop(0.4, `rgba(245, 158, 11, ${glowIntensity * 0.6})`);
      clockGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = clockGrad;
      ctx.beginPath();
      ctx.arc(clockX, clockY, clockRadius * (clockChimed ? 4.5 : 2.8), 0, Math.PI * 2);
      ctx.fill();

      // If chime active, draw acoustic chime rings
      if (clockChimed) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(clockX, clockY, clockRadius * 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 6. ROAD PERSPECTIVE COORDINATES & VEHICLES (Princes Street)
    const vpX = w * 0.518;
    const vpY = h * 0.515;
    const roadLeftBottom = w * 0.24;
    const roadRightBottom = w * 0.78;
    const roadBottomY = h * 1.0;

    const getRoadPoint = (yProg: number, lateralOffset: number) => {
      const y = vpY + (roadBottomY - vpY) * Math.pow(yProg, 1.35);
      const roadWidth = (roadRightBottom - roadLeftBottom) * Math.pow(yProg, 1.25) + (w * 0.04);
      const centerX = vpX + ((roadLeftBottom + roadRightBottom) / 2 - vpX) * yProg;
      const x = centerX + lateralOffset * (roadWidth / 2);
      return { x, y, roadWidth };
    };

    // 7. STREET LIGHTS & WET REFLECTIONS
    if (layers.streetLights) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (const v of vehiclesRef.current) {
        if (v.progress > 0.3) {
          const pt = getRoadPoint(v.progress, v.laneOffset);
          const reflGrad = ctx.createLinearGradient(pt.x, pt.y, pt.x, pt.y + 60 * v.progress);
          const isWhite = v.lane === 'southbound';
          if (isWhite) {
            reflGrad.addColorStop(0, `rgba(254, 243, 199, ${0.4 * v.progress})`);
            reflGrad.addColorStop(0.5, `rgba(251, 191, 36, ${0.25 * v.progress})`);
            reflGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          } else {
            reflGrad.addColorStop(0, `rgba(239, 68, 68, ${0.45 * v.progress})`);
            reflGrad.addColorStop(0.6, `rgba(220, 38, 38, ${0.25 * v.progress})`);
            reflGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
          }
          ctx.fillStyle = reflGrad;
          ctx.fillRect(pt.x - 18 * v.progress, pt.y, 36 * v.progress, 55 * v.progress);
        }
      }

      // Street lamp ambient glow
      const streetLamps = [
        { x: w * 0.49, y: h * 0.67, color: 'rgba(52, 211, 153, 0.4)' },
        { x: w * 0.54, y: h * 0.68, color: 'rgba(52, 211, 153, 0.4)' },
        { x: w * 0.37, y: h * 0.81, color: 'rgba(251, 191, 36, 0.3)' },
        { x: w * 0.72, y: h * 0.83, color: 'rgba(251, 191, 36, 0.3)' },
      ];

      for (const lamp of streetLamps) {
        const lampFlicker = 0.85 + 0.15 * Math.sin(t * 3.5 + lamp.x);
        const lampGrad = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 26);
        lampGrad.addColorStop(0, lamp.color.replace('0.4', (0.55 * lampFlicker).toFixed(2)).replace('0.3', (0.45 * lampFlicker).toFixed(2)));
        lampGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lampGrad;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. PRIMARY TRAFFIC MOTION (Double Decker Buses & Edinburgh Cabs)
    if (layers.traffic) {
      const sortedVehicles = [...vehiclesRef.current].sort((a, b) => a.progress - b.progress);

      for (const v of sortedVehicles) {
        const pt = getRoadPoint(v.progress, v.laneOffset);
        const scale = Math.max(0.12, Math.pow(v.progress, 1.15));

        const isBus = v.type === 'bus';
        const vWidth = (isBus ? 46 : 26) * scale;
        const vHeight = (isBus ? 72 : 44) * scale;
        const vRoofHeight = (isBus ? 32 : 14) * scale;

        ctx.save();
        ctx.translate(pt.x, pt.y);

        const rx = -vWidth / 2;
        const ry = -vHeight;

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, vWidth * 0.8, 6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vehicle Lower Chassis
        ctx.fillStyle = v.color;
        ctx.beginPath();
        ctx.roundRect(rx, ry + vRoofHeight, vWidth, vHeight - vRoofHeight, 3 * scale);
        ctx.fill();

        // Upper deck or cabin
        ctx.fillStyle = isBus ? '#4c0519' : '#0f172a';
        ctx.beginPath();
        ctx.roundRect(rx + 2 * scale, ry, vWidth - 4 * scale, vRoofHeight + 2 * scale, 2 * scale);
        ctx.fill();

        // Illuminated bus destination screen & passenger windows
        if (isBus) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
          ctx.fillRect(rx + 4 * scale, ry + 3 * scale, vWidth - 8 * scale, 5 * scale);
          ctx.fillStyle = 'rgba(254, 243, 199, 0.5)';
          ctx.fillRect(rx + 3 * scale, ry + 11 * scale, vWidth - 6 * scale, 8 * scale);
          ctx.fillRect(rx + 3 * scale, ry + vRoofHeight + 4 * scale, vWidth - 6 * scale, 9 * scale);
        }

        // Headlights or Taillights
        if (v.lane === 'southbound') {
          const lightY = ry + vHeight - 3 * scale;
          const leftLightX = rx + 3 * scale;
          const rightLightX = rx + vWidth - 3 * scale;

          ctx.fillStyle = '#fffbeb';
          ctx.shadowColor = '#fef08a';
          ctx.shadowBlur = 12 * scale;
          ctx.beginPath();
          ctx.arc(leftLightX, lightY, 3.5 * scale, 0, Math.PI * 2);
          ctx.arc(rightLightX, lightY, 3.5 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Projection cones on pavement
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const beamGrad = ctx.createLinearGradient(0, lightY, 0, lightY + 110 * scale);
          beamGrad.addColorStop(0, 'rgba(255, 250, 220, 0.55)');
          beamGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.28)');
          beamGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(leftLightX - 2 * scale, lightY);
          ctx.lineTo(-vWidth * 1.1, lightY + 110 * scale);
          ctx.lineTo(vWidth * 1.1, lightY + 110 * scale);
          ctx.lineTo(rightLightX + 2 * scale, lightY);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const lightY = ry + vHeight - 4 * scale;
          const leftLightX = rx + 4 * scale;
          const rightLightX = rx + vWidth - 4 * scale;

          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#dc2626';
          ctx.shadowBlur = 8 * scale;
          ctx.beginPath();
          ctx.arc(leftLightX, lightY, 3 * scale, 0, Math.PI * 2);
          ctx.arc(rightLightX, lightY, 3 * scale, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.fillRect(leftLightX - 2 * scale, lightY, 4 * scale, 18 * scale);
          ctx.fillRect(rightLightX - 2 * scale, lightY, 4 * scale, 18 * scale);
          ctx.restore();
        }

        ctx.restore();
      }
    }

    // 9. PEDESTRIAN COMMUTER FLOW
    if (layers.pedestrians) {
      for (const p of pedestriansRef.current) {
        const lateral = p.side === 'left' ? -0.78 + (p.id % 5) * 0.025 : 0.74 + (p.id % 5) * 0.025;
        const pt = getRoadPoint(p.progress, lateral);
        const pScale = Math.max(0.18, Math.pow(p.progress, 1.25)) * p.size;

        const pH = 16 * pScale;
        const pW = 5 * pScale;

        ctx.save();
        ctx.translate(pt.x, pt.y);

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, -pH * 0.55, pW * 0.5, pH * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, -pH * 0.9, pW * 0.42, 0, Math.PI * 2);
        ctx.fill();

        const stride = Math.sin(t * 8 * p.speed * 40 + p.id) * 3 * pScale;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2 * pScale;
        ctx.beginPath();
        ctx.moveTo(-1.2 * pScale, -pH * 0.25);
        ctx.lineTo(-1.2 * pScale + stride, 0);
        ctx.moveTo(1.2 * pScale, -pH * 0.25);
        ctx.lineTo(1.2 * pScale - stride, 0);
        ctx.stroke();

        ctx.restore();
      }
    }

    // 10. SCOTTISH WEATHER PARTICLE SIMULATION
    if (layers.weather && activeWeather !== 'clear') {
      ctx.save();
      if (activeWeather === 'scottish_rain') {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = 1.2;
        for (const pt of weatherParticlesRef.current) {
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + pt.speedX * 2, pt.y + pt.speedY * 3);
          ctx.stroke();

          // Droplet bounce on bottom road
          if (pt.y > h * 0.7 && Math.random() < 0.15) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (activeWeather === 'sea_mist') {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(226, 232, 240, 0.04)';
        for (let i = 0; i < 6; i++) {
          const mistX = ((t * 12 + i * 160) % (w * 1.4)) - w * 0.2;
          const mistY = h * (0.35 + (i % 3) * 0.15);
          ctx.beginPath();
          ctx.ellipse(mistX, mistY, 200, 60, 0.02, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (activeWeather === 'amber_leaves') {
        for (const pt of weatherParticlesRef.current) {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate((pt.rotation || 0) + t * (pt.rotationSpeed || 0.05));
          ctx.fillStyle = pt.size > 2 ? 'rgba(249, 115, 22, 0.7)' : 'rgba(217, 119, 6, 0.65)';
          ctx.beginPath();
          ctx.ellipse(0, 0, pt.size * 2, pt.size * 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // 11. WIREFRAME / PERSPECTIVE FLOW DEBUG OVERLAY
    if (showWireframe) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      for (let lat = -1; lat <= 1; lat += 0.25) {
        ctx.beginPath();
        const start = getRoadPoint(0.05, lat);
        const end = getRoadPoint(1.0, lat);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(vpX, vpY, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '10px monospace';
      ctx.fillText('STREET HORIZON ANCHOR', vpX + 12, vpY + 4);

      ctx.restore();
    }

    // End clipping if Split comparison
    if (compareMode === 'split') {
      ctx.restore();

      const splitX = (splitPosition / 100) * w;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, h);
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(splitX, h * 0.5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⬌', splitX, h * 0.5);
    }

    ctx.restore();
  }, [layers, compareMode, splitPosition, showWireframe, activeTimeOfDay, activeWeather, clockChimed]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;

    const loop = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlaying && imageLoaded) {
        const delta = Math.min(dt, 0.1) * playbackSpeed;
        simulationTimeRef.current += delta;
        const cur = simulationTimeRef.current % 15.0;
        setCurrentTime(cur);

        // Advance vehicles
        for (const v of vehiclesRef.current) {
          if (v.lane === 'southbound') {
            v.progress += v.speed * delta;
            if (v.progress > 1.05) {
              v.progress = 0.02 + Math.random() * 0.05;
              v.speed = 0.024 + Math.random() * 0.016;
            }
          } else {
            v.progress -= v.speed * delta;
            if (v.progress < 0.02) {
              v.progress = 1.0 + Math.random() * 0.05;
              v.speed = 0.024 + Math.random() * 0.016;
            }
          }
        }

        // Advance pedestrians
        for (const p of pedestriansRef.current) {
          p.progress += p.direction * p.speed * delta;
          if (p.progress > 1.0) {
            p.progress = 1.0;
            p.direction = -1;
          } else if (p.progress < 0.0) {
            p.progress = 0.0;
            p.direction = 1;
          }
        }

        // Advance weather particles
        for (const pt of weatherParticlesRef.current) {
          pt.y += pt.speedY * delta * 50;
          pt.x += pt.speedX * delta * 40;
          if (pt.y > 1280) {
            pt.y = -20;
            pt.x = Math.random() * 720;
          }
          if (pt.x > 740) pt.x = -20;
          if (pt.x < -20) pt.x = 740;
        }
      }

      renderFrame();
      animId = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(loop);
    animFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, imageLoaded, playbackSpeed, renderFrame]);

  const handleSeek = (newSeconds: number) => {
    simulationTimeRef.current = newSeconds;
    setCurrentTime(newSeconds);
    renderFrame();
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    const willBeFullscreen = !isFullscreen;
    setIsFullscreen(willBeFullscreen);

    if (willBeFullscreen && container) {
      const req =
        (container as any).requestFullscreen ||
        (container as any).webkitRequestFullscreen;
      if (typeof req === 'function') {
        try {
          req.call(container);
        } catch {
          // ignore
        }
      }
    } else {
      const exit = (document as any).exitFullscreen;
      if (typeof exit === 'function') {
        try {
          exit.call(document);
        } catch {
          // ignore
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center bg-[#090b10] border border-amber-950/40 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen rounded-none' : 'w-full'
      }`}
    >
      {/* Top Header / Environmental Bar */}
      <div className="w-full flex flex-wrap items-center justify-between px-4 py-2.5 bg-neutral-950/80 backdrop-blur-md border-b border-amber-500/10 z-20 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Living City Motion Engine
            </span>
          </div>

          <span className="text-neutral-600 text-xs">•</span>

          <span className="text-xs text-neutral-400 font-mono">
            {currentTime.toFixed(2)}s / 15.00s
          </span>
        </div>

        {/* Atmosphere & Weather Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time of Day Pills */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-0.5 flex text-[11px]">
            <button
              onClick={() => setTimeOfDay('golden_hour')}
              className={`px-2 py-0.5 rounded transition-all ${
                activeTimeOfDay === 'golden_hour' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Golden Hour Sunset"
            >
              Golden Hour
            </button>
            <button
              onClick={() => setTimeOfDay('blue_hour')}
              className={`px-2 py-0.5 rounded transition-all ${
                activeTimeOfDay === 'blue_hour' ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Blue Hour Twilight"
            >
              Blue Hour
            </button>
            <button
              onClick={() => setTimeOfDay('gothic_night')}
              className={`px-2 py-0.5 rounded transition-all ${
                activeTimeOfDay === 'gothic_night' ? 'bg-purple-500/20 text-purple-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Gothic Midnight"
            >
              Midnight
            </button>
          </div>

          {/* Weather Pills */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-0.5 flex text-[11px]">
            <button
              onClick={() => setWeather('clear')}
              className={`px-2 py-0.5 rounded transition-all ${
                activeWeather === 'clear' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Clear
            </button>
            <button
              onClick={() => setWeather('scottish_rain')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                activeWeather === 'scottish_rain' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Scottish Drizzle & Wet Asphalt"
            >
              <CloudRain className="w-3 h-3" />
              <span>Drizzle</span>
            </button>
            <button
              onClick={() => setWeather('sea_mist')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                activeWeather === 'sea_mist' ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="The Ha'ar Sea Mist"
            >
              <Wind className="w-3 h-3" />
              <span>Mist</span>
            </button>
          </div>

          {/* Clock Bell Chime Trigger */}
          <button
            onClick={handleTriggerClockChime}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              clockChimed
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg scale-105'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:text-amber-300'
            }`}
            title="Ring Balmoral Victorian Clock Tower Chime"
          >
            <Bell className={`w-3.5 h-3.5 ${clockChimed ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Clock Chime</span>
          </button>

          {/* View Modes */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-0.5 flex text-xs">
            <button
              onClick={() => setCompareMode('live')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                compareMode === 'live' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Living Motion
            </button>
            <button
              onClick={() => setCompareMode('split')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
                compareMode === 'split' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setCompareMode('static')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                compareMode === 'static' ? 'bg-amber-500/20 text-amber-300 font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Static Photo
            </button>
          </div>

          <button
            onClick={() => setShowWireframe(!showWireframe)}
            title="Toggle Perspective Wireframe"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              showWireframe
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Physics Grid</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              showSettings
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Layers</span>
          </button>

          <button
            onClick={toggleAudio}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              !isMuted
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title={isMuted ? 'Turn on Edinburgh Evening Ambiance' : 'Mute Ambiance'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 animate-pulse" />}
            <span className="hidden sm:inline">Audio</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className={`relative w-full ${isFullscreen ? 'flex-1 h-full py-1' : 'py-2'} flex items-center justify-center bg-black/90 overflow-hidden`}>
        <div className={`relative ${isFullscreen ? 'h-full max-h-[calc(100vh-140px)]' : 'max-h-[70vh]'} aspect-[9/16] shadow-2xl rounded-lg overflow-hidden border border-neutral-800`}>
          <canvas
            ref={canvasRef}
            width={720}
            height={1280}
            className="w-full h-full object-contain cursor-pointer select-none"
            onClick={() => setIsPlaying(!isPlaying)}
          />

          {compareMode === 'split' && (
            <input
              type="range"
              min="0"
              max="100"
              value={splitPosition}
              onChange={(e) => setSplitPosition(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            />
          )}

          <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/30 text-[10px] font-mono text-amber-300">
              <Camera className="w-3 h-3 text-amber-400" />
              Elevated Telephoto View
            </span>
          </div>

          <div className="absolute bottom-3 left-3 pointer-events-none z-10">
            <span className="px-2 py-1 rounded bg-black/70 backdrop-blur-md border border-neutral-800 text-[10px] text-neutral-300 font-mono">
              Princes St • Balmoral Clock Tower • 15.0s Loop
            </span>
          </div>

          {!isPlaying && (
            <div
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-opacity z-10"
            >
              <div className="p-4 rounded-full bg-amber-500/90 text-neutral-950 shadow-2xl hover:scale-105 transition-transform">
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layer Settings Drawer (Collapsible) */}
      {showSettings && (
        <div className="w-full px-5 py-3 bg-neutral-950/95 border-t border-amber-500/20 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.traffic}
              onChange={(e) => setLayers({ ...layers, traffic: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Traffic Lanes</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.pedestrians}
              onChange={(e) => setLayers({ ...layers, pedestrians: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Pedestrians</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.cloudDrift}
              onChange={(e) => setLayers({ ...layers, cloudDrift: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Sunset Clouds</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.streetLights}
              onChange={(e) => setLayers({ ...layers, streetLights: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Wet Road Glow</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.cameraPushIn}
              onChange={(e) => setLayers({ ...layers, cameraPushIn: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Subtle Push-In</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.clockLuminescence}
              onChange={(e) => setLayers({ ...layers, clockLuminescence: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Clock Tower Light</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.weather}
              onChange={(e) => setLayers({ ...layers, weather: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Weather Dynamics</span>
          </label>
        </div>
      )}

      {/* 15-Second Cinematic Timeline Bar & Controls */}
      <div className="w-full px-4 py-3 bg-neutral-950/90 backdrop-blur-md border-t border-amber-500/15 flex flex-col gap-2 z-20">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-neutral-400 w-12 text-right">
            {currentTime.toFixed(2)}s
          </span>

          <div className="relative flex-1 flex items-center group">
            <input
              type="range"
              min="0"
              max="15"
              step="0.05"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="absolute top-3 left-0 w-full flex justify-between pointer-events-none px-0.5 text-[9px] text-neutral-600 font-mono">
              <span>0s</span>
              <span>3s</span>
              <span>6s</span>
              <span>9s</span>
              <span>12s</span>
              <span>15s</span>
            </div>
          </div>

          <span className="text-xs font-mono text-neutral-500 w-12">15.00s</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-amber-500 text-neutral-950 font-bold hover:bg-amber-400 transition-colors shadow-lg"
              title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => handleSeek(0)}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
              title="Restart from 00:00"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs text-neutral-400">
              {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'hover:text-neutral-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {!isMuted && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-neutral-800 accent-amber-500 cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-amber-400/80 font-mono hidden md:inline">
              Core Principle: The World Itself Is Moving
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
