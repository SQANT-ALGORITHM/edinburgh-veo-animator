import { CityPreset } from '../types';

export const CITY_PRESETS: CityPreset[] = [
  {
    id: 'princes-street-rush',
    name: 'Princes Street & Balmoral Tower',
    landmark: 'Princes Street, New Town',
    badge: 'Flagship Masterwork',
    imageSrc: '/edinburgh-golden-rush.jpg',
    horizonRatio: 0.54,
    timeOfDay: 'golden_hour',
    weather: 'clear',
    prompt: `Animate this exact Edinburgh Golden Rush Hour image into a cinematic vertical video.
CORE PRINCIPLE: THE WORLD ITSELF IS MOVING.
Preserve the original Balmoral Victorian clock tower (running 3 minutes fast), illuminated circular clock face, Gothic spires, historic stone facades, street layout, sunset, and amber composition. Keep all architecture structurally stable and rigid.
PRIMARY MOTION: Double-decker Lothian buses and Edinburgh black cabs advance smoothly along Princes Street, maintaining realistic lane discipline and headlight beams.
SECONDARY MOTION: Commuters walk naturally along both pavements. Amber streetlights and wet asphalt reflections shift as vehicles pass. Sunset clouds drift slowly westwards.
CAMERA: Elevated locked telephoto perspective with an ultra-subtle slow push-in. No cuts or warping.`,
    description: 'The definitive Edinburgh rush hour. Victorian Gothic spires rise against blazing sunset clouds as maroon double-decker buses weave through bustling evening traffic.',
  },
  {
    id: 'royal-mile-dusk',
    name: "Royal Mile & St Giles' Lantern Spire",
    landmark: 'Old Town & Castle Rock',
    badge: 'Gothic Twilight',
    imageSrc: '/edinburgh-golden-rush.jpg',
    horizonRatio: 0.60,
    timeOfDay: 'blue_hour',
    weather: 'scottish_rain',
    prompt: `Cinematic vertical video of Edinburgh's historic Royal Mile at blue hour twilight.
Gothic sandstone closes, ancient cobblestones gleaming under gentle Scottish drizzle. The crown spire of St Giles' Cathedral silhouettes against indigo skies.
Pedestrians with umbrellas stroll past glowing tavern windows. Traditional black cabs rumble slowly across wet basalt stones, casting amber and ruby reflections.
Subtle elevated camera drift with stable historic stonework and atmospheric misty depth.`,
    description: 'Narrow Medieval closes, cobblestones glistening under soft drizzle, and glowing amber tavern windows beneath the legendary crown spire.',
  },
  {
    id: 'calton-hill-panorama',
    name: 'Calton Hill Panoramic Sunset',
    landmark: 'National Monument & Observatory',
    badge: 'Panoramic Vista',
    imageSrc: '/edinburgh-golden-rush.jpg',
    horizonRatio: 0.48,
    timeOfDay: 'golden_hour',
    weather: 'sea_mist',
    prompt: `Sweeping elevated cinematic video from Calton Hill overlooking Edinburgh at sunset.
Doric columns of the National Monument frame the dramatic skyline of Old Town, Arthur's Seat, and the Balmoral clock tower in the distance.
A soft sea mist rolls in from the Firth of Forth below, weaving around illuminated city rooftops as headlights create glowing ribbons of light along major thoroughfares.
Ultra-slow cinematic push-in preserving architectural majesty.`,
    description: 'Classical neoclassical pillars overlooking the whole Scottish capital, with distant vehicle light ribbons and rolling coastal sea mist.',
  },
  {
    id: 'dean-village-mist',
    name: 'Dean Village & Water of Leith',
    landmark: 'Water of Leith Valley',
    badge: 'Fairytale Sandstone',
    imageSrc: '/edinburgh-golden-rush.jpg',
    horizonRatio: 0.58,
    timeOfDay: 'gothic_night',
    weather: 'amber_leaves',
    prompt: `Living cinematic video of historic Dean Village in Edinburgh at dusk.
19th-century yellow sandstone milling cottages nestled along the curving Water of Leith. The river flows smoothly with gentle water ripples reflecting warm domestic lamp glow.
Autumn amber leaves flutter in the evening breeze. A solitary pedestrian crosses the stone bridge.
Steadily anchored camera with rich water physics and breathing architectural serenity.`,
    description: 'Tranquil sandstone millhouses and arched stone bridges nestled along the gentle Water of Leith river with golden reflected lamplight.',
  },
];
