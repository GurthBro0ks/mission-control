"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import RoleCard from './RoleCard';
import { AGENT_ID_MAP } from '@/lib/agent-roles';

interface Agent {
  id: number;
  name: string;
  role: string;
  color: string;
  status: string;
  location: string;
  currentTask?: string;
  x?: number;
  y?: number;
  targetX?: number;
  targetY?: number;
  facing?: 'left' | 'right' | 'up' | 'down';
  walkFrame?: number;
  speechBubble?: string;
  speechTimer?: number;
  coolerTimer?: number;
  pathHistory?: {x: number; y: number; tick: number}[];
}

const AGENT_COLORS: Record<number, string> = {
  0: '#22d3ee', // Ned
  1: '#ef4444', // Rex
  2: '#a78bfa', // Atlas
  3: '#f87171', // Sentinel
  4: '#34d399', // Git
  5: '#fbbf24', // Scout
  6: '#60a5fa', // Query
  7: '#c084fc', // Cloud
  8: '#4ade80', // Pip
};

const WATER_COOLER_QUOTES = [
  "Did you see that arb spread?",
  "NUC2 latency is way down",
  "Ned's got us grinding today",
  "Kelly fraction debate again...",
  "Shadow mode looking good",
  "Who touched the config?!",
  "Cross-venue is the play",
  "Need more coffee...",
  "Webhook handler is clean now",
  "Gurth wants it automated",
];

// Desk positions
const DESKS = [
  { x: 30, y: 51, agentId: 1, facing: 'down' },   // Rex - top
  { x: 148, y: 51, agentId: 2, facing: 'down' },  // Atlas - top
  { x: 266, y: 51, agentId: 3, facing: 'down' },  // Sentinel - top
  { x: 384, y: 51, agentId: 4, facing: 'down' },  // Git - top
  { x: 6, y: 150, agentId: 5, facing: 'right' },  // Scout - left
  { x: 6, y: 228, agentId: 6, facing: 'right' },  // Query - left
  { x: 6, y: 306, agentId: 7, facing: 'right' },  // Cloud - left
  { x: 148, y: 330, agentId: 8, facing: 'up' },   // Pip - bottom
  { x: 240, y: 190, agentId: 0, facing: 'down' }, // Ned - center (boss)
];

const WATER_COOLER = { x: 640, y: 80 };

// Dust particle type
interface DustParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = ah >> 16, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = bh >> 16, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`;
}

function getTimeOfDay(): { period: string; lightOn: boolean; windowColor: string; overlay: string } {
  const now = new Date();
  const detroit = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
  const hour = detroit.getHours();
  const minute = detroit.getMinutes();
  const time = hour + minute / 60;

  if (time >= 6 && time < 7.5) {
    // Sunrise
    return { period: 'sunrise', lightOn: false, windowColor: '#ff9966', overlay: 'rgba(255,150,100,0.1)' };
  } else if (time >= 7.5 && time < 17) {
    // Day
    return { period: 'day', lightOn: false, windowColor: '#87ceeb', overlay: 'transparent' };
  } else if (time >= 17 && time < 19) {
    // Sunset
    return { period: 'sunset', lightOn: true, windowColor: '#ff6b4a', overlay: 'rgba(255,100,50,0.15)' };
  } else if (time >= 19 && time < 20.5) {
    // Dusk
    return { period: 'dusk', lightOn: true, windowColor: '#4a5568', overlay: 'rgba(50,50,100,0.25)' };
  } else {
    // Night
    return { period: 'night', lightOn: true, windowColor: '#1a1a2e', overlay: 'rgba(20,20,60,0.4)' };
  }
}

// Ops event type
interface OpsEvent {
  id: number;
  type: string;
  source: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

// Running step type
interface RunningStep {
  id: number;
  mission_id: number;
  kind: string;
  description: string;
  status: string;
  assigned_to: string | null;
}

export default function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [detroitTime, setDetroitTime] = useState('');
  const [runningSteps, setRunningSteps] = useState<RunningStep[]>([]);
  const [reactionEvents, setReactionEvents] = useState<OpsEvent[]>([]);
  const [bulletinEvents, setBulletinEvents] = useState<OpsEvent[]>([]);
  const [agentOverlays, setAgentOverlays] = useState<{id: number; x: number; y: number; name: string; color: string; speechBubble?: string; speechTimer?: number}[]>([]);
  const animationRef = useRef<number>(0);
  const agentsRef = useRef<Agent[]>([]);
  const reactionIndexRef = useRef(0);
  const bulletinIndexRef = useRef(0);
  const dustRef = useRef<DustParticle[]>([]);
  const tickRef = useRef(0);
  const frameCountRef = useRef(0);

  // Initialize agents
  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(team => {
        const initializedAgents: Agent[] = team.subagents.map((a: any) => {
          const desk = DESKS.find(d => d.agentId === a.id);
          return {
            ...a,
            color: AGENT_COLORS[a.id],
            x: desk?.x ?? 100,
            y: desk?.y ?? 100,
            targetX: desk?.x ?? 100,
            targetY: desk?.y ?? 100,
            facing: (desk?.facing ?? 'down') as 'left' | 'right' | 'up' | 'down',
            walkFrame: 0,
            speechBubble: undefined,
            speechTimer: 0,
            pathHistory: [],
          };
        });

        // Add Ned
        const nedDesk = DESKS.find(d => d.agentId === 0);
        initializedAgents.unshift({
          id: 0,
          name: team.lead.name.split(' ')[0],
          role: team.lead.role,
          color: AGENT_COLORS[0],
          status: team.lead.status,
          location: team.lead.location,
          x: nedDesk?.x ?? 240,
          y: nedDesk?.y ?? 190,
          targetX: nedDesk?.x ?? 240,
          targetY: nedDesk?.y ?? 190,
          facing: (nedDesk?.facing ?? 'down') as 'left' | 'right' | 'up' | 'down',
          walkFrame: 0,
          pathHistory: [],
        });

        setAgents(initializedAgents);
        agentsRef.current = initializedAgents;

        // Initialize dust particles - only in lighter areas (left side office)
        const dust: DustParticle[] = [];
        for (let i = 0; i < 18; i++) {
          dust.push({
            x: 30 + Math.random() * 530,
            y: 60 + Math.random() * 300,
            size: 1 + Math.random(),
            speedX: (Math.random() - 0.5) * 0.3,
            speedY: -0.1 - Math.random() * 0.2,
            opacity: 0.1 + Math.random() * 0.1,
          });
        }
        dustRef.current = dust;
      });
  }, []);

  // Time update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const detroit = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
      setDetroitTime(detroit.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ET');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch running steps and update agent status
  useEffect(() => {
    const fetchRunningSteps = async () => {
      try {
        const res = await fetch('/api/ops/steps?status=in_progress');
        const data = await res.json();
        setRunningSteps(data.steps || []);
      } catch (err) {
        console.error('Failed to fetch running steps:', err);
      }
    };

    fetchRunningSteps();
    const interval = setInterval(fetchRunningSteps, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch reaction events for speech bubbles
  useEffect(() => {
    const fetchReactions = async () => {
      try {
        const res = await fetch('/api/ops/events?type=reaction&limit=10');
        const data = await res.json();
        setReactionEvents(data.events || []);
      } catch (err) {
        console.error('Failed to fetch reactions:', err);
      }
    };

    fetchReactions();
    const interval = setInterval(fetchReactions, 8000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent events for bulletin board
  useEffect(() => {
    const fetchBulletinEvents = async () => {
      try {
        const res = await fetch('/api/ops/events?limit=5');
        const data = await res.json();
        setBulletinEvents(data.events || []);
      } catch (err) {
        console.error('Failed to fetch bulletin events:', err);
      }
    };

    fetchBulletinEvents();
    const interval = setInterval(fetchBulletinEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update agent status based on running steps
  useEffect(() => {
    if (runningSteps.length === 0) return;

    setAgents(prev => prev.map(agent => {
      const step = runningSteps.find(s =>
        s.assigned_to?.toLowerCase() === agent.name.toLowerCase()
      );
      if (step && agent.status !== 'working') {
        return { ...agent, status: 'working' };
      }
      return agent;
    }));

    // Also update agentsRef
    agentsRef.current = agentsRef.current.map(agent => {
      const step = runningSteps.find(s =>
        s.assigned_to?.toLowerCase() === agent.name.toLowerCase()
      );
      if (step && agent.status !== 'working') {
        return { ...agent, status: 'working' };
      }
      return agent;
    });
  }, [runningSteps]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || agentsRef.current.length === 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const time = getTimeOfDay();
      const now = new Date();
      const detroit = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }));
      const hours = detroit.getHours();
      const minutes = detroit.getMinutes();
      const seconds = detroit.getSeconds();
      const tick = Math.floor(Date.now() / 100) % 100;
      tickRef.current = tick;

      // Clear
      ctx.fillStyle = '#1e3a4a';
      ctx.fillRect(0, 0, 780, 400);

      // === MAIN OFFICE (left side) ===
      // Floor - light blue-gray carpet with pattern
      for (let x = 0; x < 588; x += 12) {
        for (let y = 60; y < 400; y += 12) {
          // Alternate colors for carpet pattern
          const isAlternate = ((x / 12) + (y / 12)) % 2 === 0;
          // Every other row has green-gray
          const isGreenRow = Math.floor(y / 12) % 2 === 0;
          ctx.fillStyle = isGreenRow ? '#7a8578' : (isAlternate ? '#6b7d8a' : '#7a8d9a');
          ctx.fillRect(x, y, 12, 12);
        }
      }

      // Runner rug down middle
      ctx.fillStyle = '#8a6a5a';
      ctx.fillRect(274, 60, 40, 340);
      ctx.fillStyle = '#7a5a4a';
      ctx.fillRect(278, 64, 32, 332);

      // === WALLS ===
      // Top wall (above windows) - warm wood
      ctx.fillStyle = '#c9956a';
      ctx.fillRect(0, 0, 588, 60);
      // Shadow line
      ctx.fillStyle = '#a07850';
      ctx.fillRect(0, 59, 588, 1);

      // Side walls - left
      ctx.fillStyle = '#c49464';
      ctx.fillRect(0, 0, 30, 400);
      ctx.fillStyle = '#a07848';
      ctx.fillRect(0, 0, 30, 60); // wainscoting

      // Side walls - right (before divider)
      ctx.fillStyle = '#c49464';
      ctx.fillRect(558, 0, 30, 400);
      ctx.fillStyle = '#a07848';
      ctx.fillRect(558, 0, 30, 60); // wainscoting

      // Chair rail on side walls
      ctx.fillStyle = '#b89068';
      ctx.fillRect(0, 60, 30, 2);
      ctx.fillRect(558, 60, 30, 2);

      // Wainscoting on top wall
      ctx.fillStyle = '#a07848';
      ctx.fillRect(0, 48, 588, 12);

      // Windows on top wall - daytime with clouds
      const windowPositions = [50, 170, 290, 420];
      windowPositions.forEach(wx => {
        // Window glass - bright blue sky
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(wx, 8, 80, 36);

        // Cloud wisps
        if (time.period === 'day') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wx + 10, 14, 20, 6);
          ctx.fillRect(wx + 15, 10, 12, 4);
          ctx.fillRect(wx + 40, 18, 16, 5);
          ctx.fillRect(wx + 55, 12, 14, 4);
        }

        // Window frame
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(wx - 2, 6, 84, 40);
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(wx, 8, 80, 36);

        // Cross bars
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(wx + 38, 6, 4, 40);
        ctx.fillRect(wx - 2, 23, 84, 3);

        // Window sill
        ctx.fillStyle = '#a08060';
        ctx.fillRect(wx - 4, 44, 88, 4);

        // Sunlight beams during day
        if (time.period === 'day') {
          ctx.fillStyle = 'rgba(255, 245, 200, 0.15)';
          ctx.beginPath();
          ctx.moveTo(wx + 10, 46);
          ctx.lineTo(wx - 20, 400);
          ctx.lineTo(wx + 60, 400);
          ctx.lineTo(wx + 70, 46);
          ctx.fill();
        }
      });

      // Breakroom window
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(640, 8, 80, 36);
      if (time.period === 'day') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(650, 14, 20, 6);
        ctx.fillRect(655, 10, 12, 4);
        ctx.fillRect(680, 18, 16, 5);
      }
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(638, 6, 84, 40);
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(640, 8, 80, 36);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(678, 6, 4, 40);
      ctx.fillRect(638, 23, 84, 3);
      ctx.fillStyle = '#a08060';
      ctx.fillRect(636, 44, 88, 4);

      // Wall clock - larger with wood frame
      // Frame
      ctx.fillStyle = '#8a6a4a';
      ctx.beginPath();
      ctx.arc(520, 26, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5a3a';
      ctx.beginPath();
      ctx.arc(520, 26, 16, 0, Math.PI * 2);
      ctx.fill();

      // Clock face
      ctx.fillStyle = '#f0f0e8';
      ctx.beginPath();
      ctx.arc(520, 26, 14, 0, Math.PI * 2);
      ctx.fill();

      // Clock hands
      const secondAngle = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
      const minuteAngle = ((minutes + seconds / 60) / 60) * Math.PI * 2 - Math.PI / 2;
      const hourAngle = (((hours % 12) + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(520, 26);
      ctx.lineTo(520 + Math.cos(secondAngle) * 10, 26 + Math.sin(secondAngle) * 10);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(520, 26);
      ctx.lineTo(520 + Math.cos(minuteAngle) * 8, 26 + Math.sin(minuteAngle) * 8);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(520, 26);
      ctx.lineTo(520 + Math.cos(hourAngle) * 5, 26 + Math.sin(hourAngle) * 5);
      ctx.stroke();

      // Digital time - bright cyan
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(detroitTime, 520, 48);

      // Divider wall
      ctx.fillStyle = '#c49464';
      ctx.fillRect(588, 0, 8, 140);
      ctx.fillRect(588, 230, 8, 170);
      ctx.fillStyle = '#a07848';
      ctx.fillRect(588, 0, 8, 60);
      ctx.fillRect(588, 230, 8, 60);

      // === WHITEBOARD ===
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(420, 70, 70, 45);
      ctx.fillStyle = '#888';
      ctx.fillRect(418, 68, 74, 49);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(420, 70, 70, 45);
      // Colorful scribbles
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(430, 80, 20, 3);
      ctx.fillRect(430, 86, 15, 3);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(450, 80, 25, 3);
      ctx.fillRect(445, 86, 18, 3);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(430, 95, 30, 3);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(465, 90, 15, 3);
      // "SPRINT 4" text
      ctx.fillStyle = '#333';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPRINT 4', 455, 108);

      // Plant by doorway with sway
      const doorwaySway = Math.sin(tickRef.current * 0.08 + 1) * 1;
      ctx.fillStyle = '#228B22';
      ctx.beginPath();
      ctx.ellipse(558 + doorwaySway, 145, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.ellipse(558 + doorwaySway * 0.8, 140, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(552, 150, 12, 15);

      // Doorway to breakroom
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(590, 140, 80, 90);
      ctx.fillStyle = '#c49464';
      ctx.fillRect(590, 140, 80, 4);
      // "BREAK ROOM →" sign
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(595, 150, 70, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BREAK ROOM', 630, 161);
      // Welcome mat
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(600, 225, 60, 8);
      ctx.fillStyle = '#8a7a6a';
      ctx.fillRect(605, 227, 50, 4);

      // === BREAKROOM (right side) ===
      // Floor - wood pattern
      for (let x = 594; x < 780; x += 10) {
        for (let y = 60; y < 400; y += 10) {
          const isAlternate = ((x / 10) + (y / 10)) % 2 === 0;
          ctx.fillStyle = isAlternate ? '#8a7d6b' : '#7d7060';
          ctx.fillRect(x, y, 10, 10);
        }
      }

      // Breakroom wall
      ctx.fillStyle = '#c9956a';
      ctx.fillRect(594, 0, 186, 60);
      ctx.fillStyle = '#a07850';
      ctx.fillRect(594, 59, 186, 1);
      ctx.fillStyle = '#a07848';
      ctx.fillRect(594, 48, 186, 12);

      // Breakroom label
      ctx.save();
      ctx.translate(775, 200);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#6a5a4a';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BREAK ROOM', 0, 0);
      ctx.restore();

      // === WATER COOLER (larger) ===
      // Body
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(WATER_COOLER.x - 12, WATER_COOLER.y - 30, 24, 50);
      // Base
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(WATER_COOLER.x - 10, WATER_COOLER.y + 15, 20, 12);
      // Water jug
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(WATER_COOLER.x, WATER_COOLER.y - 35, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.arc(WATER_COOLER.x, WATER_COOLER.y - 37, 6, 0, Math.PI * 2);
      ctx.fill();
      // Tap buttons
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(WATER_COOLER.x - 6, WATER_COOLER.y - 5, 5, 4);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(WATER_COOLER.x + 1, WATER_COOLER.y - 5, 5, 4);
      // H2O label
      ctx.fillStyle = '#fff';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('H2O', WATER_COOLER.x, WATER_COOLER.y - 38);
      // Puddle
      ctx.fillStyle = '#93c5fd44';
      ctx.beginPath();
      ctx.ellipse(WATER_COOLER.x, WATER_COOLER.y + 32, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // === BULLETIN BOARD (larger, colorful) ===
      // Cork frame
      ctx.fillStyle = '#a08060';
      ctx.fillRect(696, 26, 70, 50);
      ctx.fillStyle = '#c9a060';
      ctx.fillRect(698, 28, 66, 46);
      // Colorful sticky notes - use events data if available
      const stickyColors = ['#fbbf24', '#22c55e', '#f472b6', '#3b82f6', '#a78bfa', '#fb923c'];
      const notePositions = [
        { x: 702, y: 32 },
        { x: 724, y: 32 },
        { x: 746, y: 32 },
        { x: 702, y: 52 },
        { x: 724, y: 52 },
        { x: 746, y: 52 },
      ];
      // Display events on bulletin board
      for (let i = 0; i < 6; i++) {
        const pos = notePositions[i];
        const event = bulletinEvents[i];
        ctx.fillStyle = stickyColors[i];
        ctx.fillRect(pos.x, pos.y, 18, 18);
        // Add mini text for event type if available
        if (event) {
          ctx.fillStyle = '#000';
          ctx.font = '4px monospace';
          ctx.textAlign = 'center';
          const typeStr = event.type.substring(0, 5).toUpperCase();
          ctx.fillText(typeStr, pos.x + 9, pos.y + 11);
        }
      }
      // Tack dots
      ctx.fillStyle = '#333';
      ctx.fillRect(710, 28, 2, 2);
      ctx.fillRect(732, 28, 2, 2);
      ctx.fillRect(754, 28, 2, 2);

      // === BREAK TABLE ===
      // Table - round-ish (4 overlapping rectangles)
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(655, 180, 50, 35);
      ctx.fillRect(650, 185, 50, 35);
      ctx.fillRect(655, 190, 50, 35);
      ctx.fillRect(660, 185, 50, 35);
      // Table top highlight
      ctx.fillStyle = '#8a7a6a';
      ctx.fillRect(655, 180, 50, 4);
      // Chairs in agent colors
      const chairColors = ['#22d3ee', '#ef4444', '#a78bfa', '#34d399'];
      const chairPositions = [[648, 175], [712, 175], [648, 215], [712, 215]];
      chairPositions.forEach((pos, i) => {
        ctx.fillStyle = chairColors[i];
        ctx.fillRect(pos[0], pos[1], 12, 12);
        ctx.fillStyle = '#555';
        ctx.fillRect(pos[0] + 2, pos[1] + 10, 8, 4);
      });
      // Coffee cups on table
      ctx.fillStyle = '#fff';
      ctx.fillRect(665, 188, 6, 5);
      ctx.fillRect(680, 188, 6, 5);
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(666, 190, 4, 3);
      ctx.fillRect(681, 190, 4, 3);

      // === COFFEE STATION ===
      // Counter
      ctx.fillStyle = '#a08060';
      ctx.fillRect(620, 280, 50, 40);
      ctx.fillStyle = '#c4a882';
      ctx.fillRect(620, 280, 50, 4);
      // Coffee machine
      ctx.fillStyle = '#374151';
      ctx.fillRect(625, 255, 30, 25);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(630, 260, 20, 15);
      // Red power light
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(640, 262, 2, 0, Math.PI * 2);
      ctx.fill();
      // Stack of cups
      ctx.fillStyle = '#fff';
      ctx.fillRect(628, 290, 8, 6);
      ctx.fillRect(628, 286, 8, 6);
      // "COFFEE" sign
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(622, 245, 36, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COFFEE', 640, 252);

      // === VENDING MACHINE (NEW) ===
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(730, 240, 30, 50);
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(733, 243, 24, 44);
      // Dark glass front
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(735, 245, 20, 30);
      // Snack rows - colored items
      const snackColors = ['#ef4444', '#22c55e', '#fbbf24', '#3b82f6'];
      ctx.fillStyle = snackColors[0];
      ctx.fillRect(737, 248, 4, 4);
      ctx.fillRect(744, 248, 4, 4);
      ctx.fillStyle = snackColors[1];
      ctx.fillRect(737, 254, 4, 4);
      ctx.fillRect(744, 254, 4, 4);
      ctx.fillStyle = snackColors[2];
      ctx.fillRect(737, 260, 4, 4);
      ctx.fillRect(744, 260, 4, 4);
      ctx.fillStyle = snackColors[3];
      ctx.fillRect(737, 266, 4, 4);
      ctx.fillRect(744, 266, 4, 4);
      // "SNACKS" text
      ctx.fillStyle = '#fff';
      ctx.font = '5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SNACKS', 745, 282);
      // Coin slot
      ctx.fillStyle = '#222';
      ctx.fillRect(743, 285, 4, 8);

      // === PLANT === with gentle sway
      const swayOffset = Math.sin(tickRef.current * 0.08) * 1;
      // Pot
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(736, 330, 18, 20);
      // Leaves with sway
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(745 + swayOffset, 320, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(742 + swayOffset * 0.8, 315, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(750 + swayOffset * 1.2, 318, 8, 0, Math.PI * 2);
      ctx.fill();

      // Monitor flicker effect - varies screen brightness ±5% every ~60 frames
      const flickerAmount = tick % 60 < 5 ? 0.95 : (tick % 60 < 10 ? 1.05 : 1);

      // Draw desks - all agents except Ned (drawn separately)
      DESKS.filter(d => d.agentId !== 0).forEach(desk => {
        const agent = agentsRef.current.find(a => a.id === desk.agentId);
        if (!agent) return;

        // Floor shadow under desk
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(desk.x - 50, desk.y - 10, 100, 60);

        // Chair (behind desk if facing down/right, in front if facing up/left)
        const chairColor = agent.color;
        if (desk.facing === 'down') {
          // Chair back
          ctx.fillStyle = chairColor;
          ctx.fillRect(desk.x - 8, desk.y + 12, 16, 10);
          ctx.fillStyle = '#333';
          ctx.fillRect(desk.x - 6, desk.y + 18, 12, 4);
        }

        // Desk surface - light wood 110x55 scaled down to fit
        ctx.fillStyle = '#e8d5b8';
        ctx.fillRect(desk.x - 40, desk.y - 15, 80, 30);
        // Desk edge
        ctx.fillStyle = '#c4a882';
        ctx.fillRect(desk.x - 40, desk.y + 12, 80, 3);
        // Top highlight
        ctx.fillStyle = '#f0e6d4';
        ctx.fillRect(desk.x - 40, desk.y - 15, 80, 2);
        // Wood grain lines
        ctx.fillStyle = '#d4b892';
        ctx.fillRect(desk.x - 35, desk.y - 10, 70, 1);
        ctx.fillRect(desk.x - 35, desk.y - 5, 70, 1);

        // Monitor bezel
        ctx.fillStyle = '#555e68';
        ctx.fillRect(desk.x - 20, desk.y - 12, 30, 20);
        // Screen with flicker effect
        const screenBase = agent.status === 'working' ? '#1a1a2e' : '#2a2a3e';
        ctx.fillStyle = screenBase;
        ctx.fillRect(desk.x - 17, desk.y - 9, 24, 14);
        // Apply subtle flicker overlay
        if (flickerAmount !== 1) {
          ctx.fillStyle = flickerAmount > 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
          ctx.fillRect(desk.x - 17, desk.y - 9, 24, 14);
        }
        // Screen content when working
        if (agent.status === 'working') {
          // Code lines
          ctx.fillStyle = agent.color;
          ctx.fillRect(desk.x - 14, desk.y - 6, 12, 2);
          ctx.fillRect(desk.x - 14, desk.y - 3, 18, 2);
          ctx.fillRect(desk.x - 14, desk.y, 8, 2);
          // Progress bar
          ctx.fillStyle = '#333';
          ctx.fillRect(desk.x - 14, desk.y + 4, 18, 3);
          ctx.fillStyle = agent.color;
          ctx.fillRect(desk.x - 14, desk.y + 4, 12, 3);
        }

        // Keyboard
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(desk.x - 12, desk.y + 2, 20, 5);
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(desk.x - 10, desk.y + 3, 16, 3);

        // Mouse
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(desk.x + 15, desk.y + 3, 5, 4);

        // Coffee cup
        ctx.fillStyle = '#fff';
        ctx.fillRect(desk.x - 35, desk.y + 1, 6, 5);
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(desk.x - 34, desk.y + 3, 4, 3);

        // Sticky note
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(desk.x + 22, desk.y - 2, 8, 8);

        // Chair (in front)
        if (desk.facing === 'up') {
          ctx.fillStyle = chairColor;
          ctx.fillRect(desk.x - 8, desk.y - 25, 16, 10);
          ctx.fillStyle = '#333';
          ctx.fillRect(desk.x - 6, desk.y - 25, 12, 4);
        }
      });

      // === NED'S SPECIAL DESK (boss) ===
      // Floor shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(190, 165, 130, 80);
      // Area rug - fancy
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(195, 170, 120, 70);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(200, 175, 110, 60);

      // Chair - larger executive
      ctx.fillStyle = AGENT_COLORS[0];
      ctx.fillRect(233, 195, 34, 25);
      ctx.fillStyle = '#444';
      ctx.fillRect(235, 215, 30, 8);
      // Armrests
      ctx.fillStyle = '#333';
      ctx.fillRect(230, 200, 6, 15);
      ctx.fillRect(264, 200, 6, 15);

      // Desk surface - fancy dark wood 130px wide
      ctx.fillStyle = '#6b4a3a';
      ctx.fillRect(215, 160, 70, 40);
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(215, 195, 70, 5);
      ctx.fillStyle = '#8b6a5a';
      ctx.fillRect(215, 160, 70, 3);
      // Wood grain
      ctx.fillStyle = '#7a5a4a';
      ctx.fillRect(220, 168, 60, 2);
      ctx.fillRect(220, 176, 60, 2);

      // TWO monitors with flicker
      // Monitor 1
      ctx.fillStyle = '#555e68';
      ctx.fillRect(220, 145, 28, 18);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(223, 148, 22, 12);
      if (flickerAmount !== 1) {
        ctx.fillStyle = flickerAmount > 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(223, 148, 22, 12);
      }
      // Monitor 1 screen content
      if (agentsRef.current.find(a => a.id === 0)?.status === 'working') {
        ctx.fillStyle = AGENT_COLORS[0];
        ctx.fillRect(225, 150, 10, 2);
        ctx.fillRect(225, 154, 16, 2);
        ctx.fillRect(225, 158, 8, 2);
      }
      // Monitor 2
      ctx.fillStyle = '#555e68';
      ctx.fillRect(252, 145, 28, 18);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(255, 148, 22, 12);
      if (flickerAmount !== 1) {
        ctx.fillStyle = flickerAmount > 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(255, 148, 22, 12);
      }
      // Monitor 2 screen content (different color)
      if (agentsRef.current.find(a => a.id === 0)?.status === 'working') {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(257, 150, 10, 2);
        ctx.fillRect(257, 154, 16, 2);
        ctx.fillRect(257, 158, 8, 2);
      }

      // Keyboard
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(240, 165, 25, 6);
      // Mouse
      ctx.fillStyle = '#3a3a4a';
      ctx.fillRect(270, 166, 6, 5);

      // Coffee mug - larger
      ctx.fillStyle = '#fff';
      ctx.fillRect(218, 162, 10, 8);
      ctx.fillStyle = '#4a3728';
      ctx.fillRect(220, 165, 6, 5);

      // Nameplate - gold
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(238, 185, 24, 8);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NED', 250, 191);

      // Small plant/succulent with sway
      const nedSway = Math.sin(tickRef.current * 0.08 + 2) * 0.5;
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(275, 185, 8, 10);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(279 + nedSway, 180, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(279 + nedSway * 0.7, 182, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ceiling lights (when on, but NOT during daytime)
      if (time.lightOn && time.period !== 'day' && time.period !== 'sunrise') {
        const lightPositions = [[100, 50], [200, 50], [300, 50], [400, 50], [500, 50], [650, 100]];
        lightPositions.forEach(([lx, ly]) => {
          const gradient = ctx.createRadialGradient(lx, ly + 20, 0, lx, ly + 20, 80);
          gradient.addColorStop(0, 'rgba(255, 255, 200, 0.2)');
          gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(lx, ly + 20, 80, 0, Math.PI * 2);
          ctx.fill();
        });
        // Light fixtures themselves
        lightPositions.forEach(([lx, ly]) => {
          ctx.fillStyle = '#ccc';
          ctx.fillRect(lx - 15, ly, 30, 4);
          ctx.fillStyle = '#fff';
          ctx.fillRect(lx - 12, ly + 2, 24, 2);
        });
      }

      // Ambient dust motes - floating particles in lighter areas
      dustRef.current.forEach(dust => {
        // Update position
        dust.x += dust.speedX + Math.sin(tickRef.current * 0.05 + dust.x) * 0.1;
        dust.y += dust.speedY;
        // Wrap around when out of bounds
        if (dust.y < 60) {
          dust.y = 380;
          dust.x = 30 + Math.random() * 530;
        }
        if (dust.x < 30) dust.x = 530;
        if (dust.x > 560) dust.x = 60;
        // Draw dust particle
        ctx.fillStyle = `rgba(255, 255, 255, ${dust.opacity})`;
        ctx.fillRect(Math.floor(dust.x), Math.floor(dust.y), dust.size, dust.size);
      });

      // Day/night overlay
      if (time.overlay !== 'transparent') {
        ctx.fillStyle = time.overlay;
        ctx.fillRect(0, 0, 780, 400);
      }

      // Update and draw agents
      agentsRef.current.forEach(agent => {
        if (!agent.x || !agent.y) return;

        // AI behavior
        if (agent.status === 'idle' || agent.status === 'on-demand') {
          // Random movement
          if (!agent.targetX || !agent.targetY || 
              (Math.abs(agent.x - agent.targetX) < 5 && Math.abs(agent.y - agent.targetY) < 5)) {
            // At target, choose new one
            if (Math.random() < 0.35 && agent.id !== 0) {
              // Go to water cooler
              agent.targetX = WATER_COOLER.x + (Math.random() - 0.5) * 30;
              agent.targetY = WATER_COOLER.y + 40;
            } else {
              agent.targetX = 30 + Math.random() * 530;
              agent.targetY = 60 + Math.random() * 300;
            }
          }
          
          // Move toward target
          const dx = agent.targetX - agent.x;
          const dy = agent.targetY - agent.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 1) {
            const prevX = agent.x;
            const prevY = agent.y;
            agent.x += (dx / dist) * 0.4;
            agent.y += (dy / dist) * 0.4;
            agent.walkFrame = (agent.walkFrame || 0) + 0.2;

            // Track path history if moved more than 3px from last point
            if (!agent.pathHistory) agent.pathHistory = [];
            const lastPoint = agent.pathHistory[agent.pathHistory.length - 1];
            const movedDist = lastPoint
              ? Math.sqrt((agent.x - lastPoint.x) ** 2 + (agent.y - lastPoint.y) ** 2)
              : 999;
            if (movedDist > 3) {
              agent.pathHistory.push({ x: agent.x, y: agent.y, tick: tickRef.current });
              // Keep only last 60 points
              if (agent.pathHistory.length > 60) {
                agent.pathHistory.shift();
              }
            }

            // Set facing based on movement
            if (Math.abs(dx) > Math.abs(dy)) {
              agent.facing = dx > 0 ? 'right' : 'left';
            } else {
              agent.facing = dy > 0 ? 'down' : 'up';
            }
          }

          // Water cooler stop and chat
          if (agent.id !== 0 &&
              Math.abs(agent.x - WATER_COOLER.x) < 30 &&
              Math.abs(agent.y - WATER_COOLER.y - 40) < 20) {
            // Start cooling timer if not already set
            if (!agent.coolerTimer && !agent.speechBubble) {
              agent.coolerTimer = 300 + Math.random() * 300; // 5-10 seconds at 60fps
            }
            // Show speech bubble during cooldown
            if (agent.coolerTimer && agent.coolerTimer > 200 && !agent.speechBubble && Math.random() < 0.02) {
              const quote = WATER_COOLER_QUOTES[Math.floor(Math.random() * WATER_COOLER_QUOTES.length)];
              agent.speechBubble = quote;
              agent.speechTimer = 80 + Math.random() * 60;
              // Post to comms API
              fetch('/api/comms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: agent.name,
                  to: 'all',
                  message: quote,
                  channel: 'watercooler',
                }),
              }).catch(() => {});
            }
            // Don't move while at watercooler
            if (agent.coolerTimer && agent.coolerTimer > 0) {
              agent.coolerTimer--;
              // Don't move, but CONTINUE to render the agent
            } else {
              // Reset cooler timer when away from watercooler
              agent.coolerTimer = 0;
            }
          }

          // Speech bubble timer
          if (agent.speechTimer && agent.speechTimer > 0) {
          agent.speechTimer--;
          if (agent.speechTimer <= 0) {
            agent.speechBubble = undefined;
          }
        }

        }

        // Path trail - dashed line behind walking agents
        if (agent.pathHistory && agent.pathHistory.length > 1) {
          ctx.setLineDash([4, 6]);
          ctx.lineWidth = 1;
          for (let i = 1; i < agent.pathHistory.length; i++) {
            const prev = agent.pathHistory[i - 1];
            const curr = agent.pathHistory[i];
            // Fade based on index (newer = more opaque)
            const alpha = (i / agent.pathHistory.length) * 0.3;
            ctx.strokeStyle = agent.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(agent.x, agent.y + 14, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs (animated when walking)
        const legOffset = agent.status === 'idle' || agent.status === 'on-demand'
          ? Math.sin(agent.walkFrame || 0) * 2
          : 0;
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(agent.x - 4, agent.y + 8, 3, 7 + legOffset);
        ctx.fillRect(agent.x + 1, agent.y + 8, 3, 7 - legOffset);

        // Body - colored shirt with darker outline
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(agent.x - 8, agent.y - 6, 16, 15);
        ctx.fillStyle = agent.color;
        ctx.fillRect(agent.x - 7, agent.y - 5, 14, 13);
        // Shirt collar
        ctx.fillStyle = '#fff';
        ctx.fillRect(agent.x - 2, agent.y - 5, 4, 3);

        // Head - skin tone
        ctx.fillStyle = '#f5c882';
        ctx.fillRect(agent.x - 7, agent.y - 21, 14, 15);
        // Hair
        ctx.fillStyle = '#4a3520';
        ctx.fillRect(agent.x - 7, agent.y - 21, 14, 5);

        // Agent-specific accessories
        if (agent.id === 0) {
          // Ned - gold crown
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(agent.x - 6, agent.y - 28, 12, 6);
          ctx.fillStyle = '#ffaa00';
          ctx.fillRect(agent.x - 4, agent.y - 30, 3, 3);
          ctx.fillRect(agent.x + 1, agent.y - 30, 3, 3);
        } else if (agent.id === 1) {
          // Rex - red headband
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(agent.x - 7, agent.y - 19, 14, 3);
          ctx.fillRect(agent.x + 5, agent.y - 19, 3, 8);
        } else if (agent.id === 2) {
          // Atlas - purple glasses
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(agent.x - 6, agent.y - 16, 5, 3);
          ctx.fillRect(agent.x + 1, agent.y - 16, 5, 3);
          ctx.fillStyle = '#4a1a6b';
          ctx.fillRect(agent.x - 5, agent.y - 15, 3, 2);
          ctx.fillRect(agent.x + 2, agent.y - 15, 3, 2);
        } else if (agent.id === 3) {
          // Sentinel - red beret
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(agent.x - 8, agent.y - 26, 16, 6);
          ctx.fillRect(agent.x - 5, agent.y - 28, 4, 3);
        } else if (agent.id === 4) {
          // Git - green baseball cap
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(agent.x - 7, agent.y - 25, 14, 5);
          ctx.fillRect(agent.x + 4, agent.y - 23, 6, 3);
        } else if (agent.id === 5) {
          // Scout - radar dish (blinks)
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(agent.x - 2, agent.y - 30, 4, 6);
          ctx.beginPath();
          ctx.arc(agent.x, agent.y - 31, 5, 0, Math.PI * 2);
          ctx.fill();
          // Blink effect
          if (tick % 20 < 10) {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(agent.x, agent.y - 31, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (agent.id === 6) {
          // Query - blue headset
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(agent.x - 8, agent.y - 18, 2, 6);
          ctx.fillRect(agent.x + 6, agent.y - 18, 2, 6);
          ctx.fillRect(agent.x - 8, agent.y - 16, 6, 2);
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(agent.x - 9, agent.y - 14, 3, 3);
        } else if (agent.id === 7) {
          // Cloud - purple fluffy hair
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(agent.x - 5, agent.y - 24, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(agent.x + 5, agent.y - 24, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(agent.x, agent.y - 26, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (agent.id === 8) {
          // Pip - green visor
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(agent.x - 7, agent.y - 17, 14, 4);
          ctx.fillStyle = '#166534';
          ctx.fillRect(agent.x - 6, agent.y - 16, 12, 2);
        }

        // Eyes based on facing
        ctx.fillStyle = '#000';
        if (agent.facing === 'right') {
          ctx.fillRect(agent.x + 1, agent.y - 16, 3, 3);
        } else if (agent.facing === 'left') {
          ctx.fillRect(agent.x - 4, agent.y - 16, 3, 3);
        } else if (agent.facing === 'down') {
          ctx.fillRect(agent.x - 3, agent.y - 16, 2, 2);
          ctx.fillRect(agent.x + 1, agent.y - 16, 2, 2);
        } else {
          ctx.fillRect(agent.x - 3, agent.y - 18, 2, 2);
          ctx.fillRect(agent.x + 1, agent.y - 18, 2, 2);
        }

        // Status dot - adjusted for new head position
        const statusColors: Record<string, string> = {
          'working': '#22c55e',
          'idle': '#fbbf24',
          'busy': '#ef4444',
          'on-demand': '#6b7280',
          'active': '#22c55e',
        };
        ctx.fillStyle = statusColors[agent.status] || '#6b7280';
        ctx.beginPath();
        ctx.arc(agent.x + 7, agent.y - 26, 3, 0, Math.PI * 2);
        ctx.fill();

        // Speech bubble logic (rendered via CSS overlay)
        // Keep this computation for CSS overlay rendering
        let displayBubble = agent.speechBubble;
        if (!displayBubble && reactionEvents.length > 0) {
          const tick = Math.floor(Date.now() / 1000);
          if (tick % 8 === agent.id) {
            const reactionIndex = Math.floor(tick / 8) % reactionEvents.length;
            const reaction = reactionEvents[reactionIndex];
            if (reaction?.data?.message) {
              displayBubble = String(reaction.data.message).substring(0, 15);
            }
          }
        }

        // Monitor glow when working (reduced for daytime)
        if (agent.status === 'working' && time.period !== 'day') {
          ctx.fillStyle = `${agent.color}25`;
          ctx.beginPath();
          ctx.ellipse(agent.x, agent.y - 10, 25, 18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Sync agent overlays to state (throttled to every 3 frames)
      frameCountRef.current++;
      if (frameCountRef.current % 3 === 0) {
        setAgentOverlays(agentsRef.current.map(a => ({
          id: a.id,
          x: a.x || 0,
          y: a.y || 0,
          name: a.name,
          color: a.color,
          speechBubble: a.speechBubble,
          speechTimer: a.speechTimer,
        })));
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [agents.length]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check agent clicks
    for (const agent of agents) {
      if (agent.x === undefined || agent.y === undefined) continue;
      if (Math.abs(x - agent.x) < 15 && Math.abs(y - agent.y) < 25) {
        setSelectedAgent(agent);
        return;
      }
    }

    setSelectedAgent(null);
  }, [agents]);

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', maxWidth: '960px', margin: '0 auto' }}>
        <canvas
          ref={canvasRef}
          width={780}
          height={400}
          onClick={handleCanvasClick}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '780 / 400',
            display: 'block',
            borderRadius: '12px',
            border: '2px solid #1e3a4a',
            imageRendering: 'pixelated',
            cursor: 'pointer',
          }}
        />

        {/* CSS-rendered agent name labels and speech bubbles */}
        {agentOverlays.length > 0 && agentOverlays.map(overlay => overlay.x > 0 && overlay.y > 0 && (
          <div key={overlay.id}>
            {/* Name label */}
            <span
              style={{
                position: 'absolute',
                left: `${(overlay.x / 780) * 100}%`,
                top: `${((overlay.y + 14) / 400) * 100}%`,
                transform: 'translateX(-50%)',
                background: '#000000cc',
                color: overlay.color,
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                border: `1px solid ${overlay.color}44`,
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {overlay.name}
            </span>

            {/* Speech bubble */}
            {overlay.speechBubble && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(overlay.x / 780) * 100}%`,
                  top: `${((overlay.y - 50) / 400) * 100}%`,
                  transform: 'translateX(-50%)',
                  background: '#ffffffee',
                  color: '#1a1a2e',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  border: `1px solid ${overlay.color}`,
                  opacity: overlay.speechTimer && overlay.speechTimer < 60 ? overlay.speechTimer / 60 : 1,
                  transition: 'opacity 0.3s ease-out',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                {overlay.speechBubble.substring(0, 40)}
                {/* Triangle pointer */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #ffffffee',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Agent badges row - below canvas */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.75rem',
        marginTop: '16px',
        padding: '12px',
      }}>
        {agents.map((agent) => {
          const statusColor = agent.status === 'working' || agent.status === 'active' ? '#22c55e' :
                            agent.status === 'idle' ? '#f59e0b' : '#6b7280';
          const accentColor = AGENT_COLORS[agent.id] || '#22d3ee';
          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              title={`${agent.name} - ${agent.status}`}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: `${accentColor}22`,
                border: `2px solid ${accentColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'transform 0.1s, box-shadow 0.2s',
                boxShadow: `0 0 8px ${accentColor}40`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = `0 0 16px ${accentColor}60`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 0 8px ${accentColor}40`;
              }}
            >
              <span style={{ color: accentColor, fontSize: '14px', fontWeight: 700 }}>
                {agent.name[0]}
              </span>
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: statusColor,
                border: '2px solid #0a0a0f',
              }} />
            </div>
          );
        })}
      </div>

      {/* Role Card modal */}
      {selectedAgent && (
        <RoleCard
          agentKey={AGENT_ID_MAP[selectedAgent.id] || 'ned'}
          agentData={{
            status: selectedAgent.status,
            currentTask: selectedAgent.currentTask,
            completedToday: 0,
            failedRecently: 0,
          }}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
