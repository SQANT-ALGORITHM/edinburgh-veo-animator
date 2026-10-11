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
} from 'lucide-react';
import { cityAudio } from '../utils/audio';
import { MotionLayerSettings } from '../types';

interface LivingCanvasProps {
  imageSrc: string;
  isCustomImage?: boolean;
}

interface Vehicle {
  id: number;
  lane: 'northbound' | 'southbound'; // southbound = moving down towards camera, northbound = moving up
  laneOffset: number; // -1 to 1 across lane width
  progress: number; // 0 (horizon) to 1 (foreground)
  speed: number;
  type: 'bus' | 'car' | 'cab';
  color: string;
  lightIntensity: number;
}

interface Pedestrian {
  id: number;
  side: 'left' | 'right';
  progress: number; // 0 to 1
  direction: 1 | -1;
  speed: number;
  color: string;
  size: number;
}

export const LivingCanvas: React.FC<LivingCanvasProps> = ({
  imageSrc,
  isCustomImage = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0); // 0 to 15 seconds
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.4);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compareMode, setCompareMode] = useState<'live' | 'split' | 'static'>('live');
  const [splitPosition, setSplitPosition] = useState(50); // percentage
  const [showWireframe, setShowWireframe] = useState(false);

  // Motion layers
  const [layers, setLayers] = useState<MotionLayerSettings>({
    traffic: true,
    pedestrians: true,
    cloudDrift: true,
    streetLights: true,
    cameraPushIn: true,
    clockLuminescence: true,
  });

  const [showSettings, setShowSettings] = useState(false);

  // Simulation state
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const simulationTimeRef = useRef<number>(0);

  // Vehicles and Pedestrians pool
  const vehiclesRef = useRef<Vehicle[]>([]);
  const pedestriansRef = useRef<Pedestrian[]>([]);

  // Initialize vehicles for Princes Street
  useEffect(() => {
    const vehicles: Vehicle[] = [
      // Double decker Lothian buses
      { id: 1, lane: 'southbound', laneOffset: -0.25, progress: 0.88, speed: 0.024, type: 'bus', color: '#881337', lightIntensity: 1.0 },
      { id: 2, lane: 'southbound', laneOffset: 0.28, progress: 0.72, speed: 0.026, type: 'bus', color: '#9f1239', lightIntensity: 0.95 },
      { id: 3, lane: 'southbound', laneOffset: -0.15, progress: 0.52, speed: 0.028, type: 'bus', color: '#881337', lightIntensity: 0.9 },
      { id: 4, lane: 'northbound', laneOffset: 0.35, progress: 0.65, speed: 0.029, type: 'bus', color: '#9f1239', lightIntensity: 0.85 },
      // Cars & Cabs
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

  // Handle Audio toggle
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

    const t = simulationTimeRef.current; // seconds
    const loopDuration = 15.0; // 15-second cinematic loop
    const normalizedLoop = (t % loopDuration) / loopDuration;

    // 1. Camera Zoom Calculation (Subtle elevated push-in from 1.000 to 1.045)
    let zoom = 1.0;
    if (layers.cameraPushIn && compareMode !== 'static') {
      // Smooth sinusoidal cinematic push-in
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

    // 3. SKY & CLOUDS DRIFT LAYER (y: 0 to 0.42 * h)
    if (layers.cloudDrift) {
      ctx.save();
      // Clip to sky region above roofline & spires
      ctx.beginPath();
      ctx.rect(0, 0, w, h * 0.42);
      ctx.clip();

      const cloudDriftOffset1 = ((t * 8) % w);
      const cloudDriftOffset2 = ((t * 4) % w);

      // Warm dusk cloud breathing gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
      const sunsetPulse = 0.06 * Math.sin(t * 0.4);
      skyGrad.addColorStop(0, 'rgba(30, 20, 35, 0.08)');
      skyGrad.addColorStop(0.5, `rgba(249, 115, 22, ${0.07 + sunsetPulse})`);
      skyGrad.addColorStop(0.85, `rgba(251, 146, 60, ${0.1 + sunsetPulse * 1.2})`);
      skyGrad.addColorStop(1, 'rgba(217, 119, 6, 0.05)');

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.42);

      // Wispy cloud drift bands
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(253, 186, 116, 0.035)';
      for (let i = 0; i < 4; i++) {
        const cy = h * (0.08 + i * 0.08);
        const cx = ((cloudDriftOffset1 * (1 + i * 0.3) + i * 180) % (w * 1.5)) - w * 0.25;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 260, 42, 0.05, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(249, 115, 22, 0.025)';
      for (let i = 0; i < 3; i++) {
        const cy = h * (0.12 + i * 0.09);
        const cx = ((cloudDriftOffset2 * (0.8 + i * 0.4) + i * 220) % (w * 1.5)) - w * 0.25;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 320, 55, -0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. BALMORAL HOTEL CLOCK TOWER ILLUMINATION (x: ~0.18*w, y: ~0.37*h)
    if (layers.clockLuminescence) {
      ctx.save();
      const clockX = w * 0.185;
      const clockY = h * 0.265;
      const clockRadius = w * 0.042;

      // Soft warm radiance breathing
      const glowIntensity = 0.22 + 0.05 * Math.sin(t * 1.2);
      const clockGrad = ctx.createRadialGradient(
        clockX, clockY, clockRadius * 0.2,
        clockX, clockY, clockRadius * 2.8
      );
      clockGrad.addColorStop(0, `rgba(254, 240, 138, ${glowIntensity})`);
      clockGrad.addColorStop(0.4, `rgba(245, 158, 11, ${glowIntensity * 0.6})`);
      clockGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = clockGrad;
      ctx.beginPath();
      ctx.arc(clockX, clockY, clockRadius * 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. ROAD PERSPECTIVE COORDINATES & VEHICLES (Princes Street)
    // Vanishing Point at top of Princes Street
    const vpX = w * 0.518;
    const vpY = h * 0.515;

    // Road bottom bounds
    const roadLeftBottom = w * 0.24;
    const roadRightBottom = w * 0.78;
    const roadBottomY = h * 1.0;

    // Helper: calculate x coordinate in perspective at progress yProg (0 = horizon, 1 = bottom)
    const getRoadPoint = (yProg: number, lateralOffset: number) => {
      // lateralOffset: -1 is left curb, 0 is center line, 1 is right curb
      const y = vpY + (roadBottomY - vpY) * Math.pow(yProg, 1.35);
      const roadWidth = (roadRightBottom - roadLeftBottom) * Math.pow(yProg, 1.25) + (w * 0.04);
      const centerX = vpX + ( (roadLeftBottom + roadRightBottom) / 2 - vpX ) * yProg;
      const x = centerX + (lateralOffset * (roadWidth / 2));
      return { x, y, roadWidth };
    };

    // 6. STREET LIGHTS & WET REFLECTIONS
    if (layers.streetLights) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Moving wet asphalt reflections beneath traffic
      for (const v of vehiclesRef.current) {
        if (v.progress > 0.3) {
          const pt = getRoadPoint(v.progress, v.laneOffset);
          const reflGrad = ctx.createLinearGradient(pt.x, pt.y, pt.x, pt.y + 60 * v.progress);
          const isWhite = v.lane === 'southbound';
          if (isWhite) {
            reflGrad.addColorStop(0, `rgba(254, 243, 199, ${0.35 * v.progress})`);
            reflGrad.addColorStop(0.5, `rgba(251, 191, 36, ${0.2 * v.progress})`);
            reflGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          } else {
            reflGrad.addColorStop(0, `rgba(239, 68, 68, ${0.4 * v.progress})`);
            reflGrad.addColorStop(0.6, `rgba(220, 38, 38, ${0.2 * v.progress})`);
            reflGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
          }
          ctx.fillStyle = reflGrad;
          ctx.fillRect(pt.x - 18 * v.progress, pt.y, 36 * v.progress, 55 * v.progress);
        }
      }

      // Street lamp ambient glow shimmering
      const streetLamps = [
        { x: w * 0.49, y: h * 0.67, color: 'rgba(52, 211, 153, 0.4)' }, // green pedestrian crossing
        { x: w * 0.54, y: h * 0.68, color: 'rgba(52, 211, 153, 0.4)' },
        { x: w * 0.37, y: h * 0.81, color: 'rgba(251, 191, 36, 0.3)' },
        { x: w * 0.72, y: h * 0.83, color: 'rgba(251, 191, 36, 0.3)' },
      ];

      for (const lamp of streetLamps) {
        const lampFlicker = 0.85 + 0.15 * Math.sin(t * 3.5 + lamp.x);
        const lampGrad = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 24);
        lampGrad.addColorStop(0, lamp.color.replace('0.4', (0.5 * lampFlicker).toFixed(2)).replace('0.3', (0.4 * lampFlicker).toFixed(2)));
        lampGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lampGrad;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 7. PRIMARY TRAFFIC MOTION (Buses & Cars moving naturally along Princes Street)
    if (layers.traffic) {
      // Sort vehicles by progress so vehicles farther away are drawn first
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

        // Vehicle Shadow
        ctx.fillStyle = 'rgba(5, 5, 8, 0.65)';
        ctx.beginPath();
        ctx.ellipse(0, 4 * scale, vWidth * 0.65, 8 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vehicle Body
        ctx.fillStyle = v.color;
        // Rounded vehicle body
        const rx = -vWidth / 2;
        const ry = -vHeight;
        ctx.beginPath();
        ctx.roundRect(rx, ry, vWidth, vHeight, 4 * scale);
        ctx.fill();

        // Vehicle Roof / Cab
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(rx + 2 * scale, ry + 2 * scale, vWidth - 4 * scale, vRoofHeight);

        // Double-decker bus illuminated windows
        if (isBus) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
          const winH = 8 * scale;
          // Upper deck windows
          ctx.fillRect(rx + 4 * scale, ry + 8 * scale, vWidth - 8 * scale, winH);
          // Lower deck windows
          ctx.fillRect(rx + 4 * scale, ry + 24 * scale, vWidth - 8 * scale, winH);

          // Route destination display LED
          ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
          ctx.fillRect(rx + 6 * scale, ry + 3 * scale, vWidth - 12 * scale, 3 * scale);
        }

        // Headlights or Taillights based on direction
        const isFacingCamera = v.lane === 'southbound';

        if (isFacingCamera) {
          // Southbound = Heading towards camera -> Brilliant warm headlights
          const lightY = ry + vHeight - 4 * scale;
          const leftLightX = rx + 4 * scale;
          const rightLightX = rx + vWidth - 4 * scale;

          // Headlight bulbs
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(leftLightX, lightY, 3.5 * scale, 0, Math.PI * 2);
          ctx.arc(rightLightX, lightY, 3.5 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Headlight projection cones on pavement
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
          // Northbound = Moving away towards spires -> Red glowing taillights
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

          // Subtle red tail streak behind
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

    // 8. PEDESTRIAN FLOW ALONG BOTH PAVEMENTS
    if (layers.pedestrians) {
      for (const p of pedestriansRef.current) {
        // Left pavement: lateral -0.85 to -0.65; Right pavement: lateral 0.65 to 0.88
        const lateral = p.side === 'left' ? -0.78 + (p.id % 5) * 0.025 : 0.74 + (p.id % 5) * 0.025;
        const pt = getRoadPoint(p.progress, lateral);
        const pScale = Math.max(0.18, Math.pow(p.progress, 1.25)) * p.size;

        const pH = 16 * pScale;
        const pW = 5 * pScale;

        ctx.save();
        ctx.translate(pt.x, pt.y);

        // Pedestrian body (silhouette against golden street lamps)
        ctx.fillStyle = p.color;
        // Torso/Coat
        ctx.beginPath();
        ctx.ellipse(0, -pH * 0.55, pW * 0.5, pH * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(0, -pH * 0.9, pW * 0.42, 0, Math.PI * 2);
        ctx.fill();

        // Subtle leg motion stride
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

    // 9. WIREFRAME / PERSPECTIVE FLOW DEBUG OVERLAY
    if (showWireframe) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Perspective street guidelines
      for (let lat = -1; lat <= 1; lat += 0.25) {
        ctx.beginPath();
        const start = getRoadPoint(0.05, lat);
        const end = getRoadPoint(1.0, lat);
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      // Vanishing point reticle
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

      // Draw Split Divider Line
      const splitX = (splitPosition / 100) * w;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, h);
      ctx.stroke();

      // Split Handle Badge
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
  }, [layers, compareMode, splitPosition, showWireframe]);

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

        // Advance vehicles along Princes Street
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

        // Advance pedestrians along sidewalks
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

  // Scrubber jump
  const handleSeek = (newSeconds: number) => {
    simulationTimeRef.current = newSeconds;
    setCurrentTime(newSeconds);
    renderFrame();
  };

  // Handle fullscreen toggle with browser & iframe resilience
  const toggleFullscreen = () => {
    const container = containerRef.current;
    const willBeFullscreen = !isFullscreen;
    setIsFullscreen(willBeFullscreen);

    if (willBeFullscreen && container) {
      // Try native element requestFullscreen if available
      const req =
        (container as any).requestFullscreen ||
        (container as any).webkitRequestFullscreen ||
        (container as any).mozRequestFullScreen ||
        (container as any).msRequestFullscreen;

      if (typeof req === 'function') {
        try {
          const promise = req.call(container);
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
              // Graceful fallback to CSS in-window fullscreen inside iframe
            });
          }
        } catch {
          // Gracefully continue using CSS in-window fullscreen
        }
      }
    } else {
      // Try exitFullscreen if active
      const exit =
        (document as any).exitFullscreen ||
        (document as any).webkitExitFullscreen ||
        (document as any).mozCancelFullScreen ||
        (document as any).msExitFullscreen;

      const isDocFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (isDocFull && typeof exit === 'function') {
        try {
          const promise = exit.call(document);
          if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
          }
        } catch {
          // Ignore
        }
      }
    }
  };

  // Sync fullscreen state with document events and Escape key
  useEffect(() => {
    const handleFsChange = () => {
      const isDocFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isDocFull && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center bg-[#090b10] border border-amber-950/40 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen rounded-none' : 'w-full'
      }`}
    >
      {/* Top Header / Mode Bar */}
      <div className="w-full flex items-center justify-between px-4 py-2.5 bg-neutral-950/80 backdrop-blur-md border-b border-amber-500/10 z-20">
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

        {/* View Modes */}
        <div className="flex items-center gap-2">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-0.5 flex text-xs">
            <button
              onClick={() => setCompareMode('live')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                compareMode === 'live'
                  ? 'bg-amber-500/20 text-amber-300 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Living Motion
            </button>
            <button
              onClick={() => setCompareMode('split')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
                compareMode === 'split'
                  ? 'bg-amber-500/20 text-amber-300 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Split Slider
            </button>
            <button
              onClick={() => setCompareMode('static')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                compareMode === 'static'
                  ? 'bg-amber-500/20 text-amber-300 font-medium'
                  : 'text-neutral-400 hover:text-neutral-200'
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
            <span className="hidden sm:inline">Atmosphere</span>
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
        {/* Aspect Ratio Container for Vertical 9:16 Video */}
        <div className={`relative ${isFullscreen ? 'h-full max-h-[calc(100vh-140px)]' : 'max-h-[70vh]'} aspect-[9/16] shadow-2xl rounded-lg overflow-hidden border border-neutral-800`}>
          <canvas
            ref={canvasRef}
            width={720}
            height={1280}
            className="w-full h-full object-contain cursor-pointer select-none"
            onClick={() => setIsPlaying(!isPlaying)}
          />

          {/* Interactive Split Slider Dragger overlay */}
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

          {/* Watermark/Badges */}
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

          {/* Play/Pause overlay when paused */}
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
        <div className="w-full px-5 py-3 bg-neutral-950/95 border-t border-amber-500/20 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.traffic}
              onChange={(e) => setLayers({ ...layers, traffic: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Princes St Traffic</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.pedestrians}
              onChange={(e) => setLayers({ ...layers, pedestrians: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Pavement Walkers</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.cloudDrift}
              onChange={(e) => setLayers({ ...layers, cloudDrift: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span className="text-neutral-300">Dusk Sunset Clouds</span>
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
        </div>
      )}

      {/* 15-Second Cinematic Timeline Bar & Controls */}
      <div className="w-full px-4 py-3 bg-neutral-950/90 backdrop-blur-md border-t border-amber-500/15 flex flex-col gap-2 z-20">
        {/* Scrubber Progress Slider */}
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
            {/* 15s visual marker ticks */}
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

        {/* Bottom Playback Action Bar */}
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

            {/* Playback speed toggle */}
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

          {/* Volume slider when audio is enabled */}
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
