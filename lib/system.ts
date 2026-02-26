import si from 'systeminformation';
import fs from 'fs';
import { getSteps, getMissions, getProposals } from './ops';

export interface SystemHealth {
  status: string;
  uptime: number;
  cpu: number;
  ram: number;
  disk: number;
  activeAgents: number;
  totalTasks: number;
  openComms: number;
  lastWebhook: string | null;
  activeMissions: number;
  queuedSteps: number;
  pendingProposals: number;
  runningSteps: number;
  completedToday: number;
  workerAlive: boolean;
  heartbeatAlive: boolean;
}

function getAgentCount(): number {
  try {
    const teamPath = '/home/slimy/ned-clawd/team.json';
    if (fs.existsSync(teamPath)) {
      const team = JSON.parse(fs.readFileSync(teamPath, 'utf8'));
      return team.subagents?.filter((a: any) => a.status === 'working').length || 0;
    }
  } catch {}
  return 0;
}

function getTaskCount(): number {
  try {
    const tasksPath = '/home/slimy/ned-clawd/tasks/taskboard.json';
    if (fs.existsSync(tasksPath)) {
      const board = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
      return board.tasks?.length || 0;
    }
  } catch {}
  return 0;
}

function getCommsCount(): number {
  try {
    const { getMessageCount } = require('./db');
    return getMessageCount();
  } catch {
    return 0;
  }
}

function checkHeartbeat(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const timestamp = fs.readFileSync(filePath, 'utf8').trim();
    if (!timestamp) return false;
    const lastBeat = new Date(timestamp).getTime();
    const now = Date.now();
    // Consider alive if modified within 5 minutes
    return (now - lastBeat) < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

let lastWebhookTime: string | null = null;

export function updateLastWebhook() {
  lastWebhookTime = new Date().toISOString();
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [cpu, mem, disk, load, time] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.currentLoad(),
    si.time(),
  ]);

  const rootDisk = disk.find((d) => d.mount === '/') || disk[0];
  const diskUsage = rootDisk ? Math.round((rootDisk.used / rootDisk.size) * 100) : 0;

  // Get task count
  let totalTasks = 0;
  try {
    const tasksPath = '/home/slimy/ned-clawd/tasks/taskboard.json';
    if (fs.existsSync(tasksPath)) {
      const board = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
      totalTasks = board.tasks?.length || 0;
    }
  } catch {}

  // Get ops counts
  let activeMissions = 0;
  let queuedSteps = 0;
  let pendingProposals = 0;
  let runningSteps = 0;
  let completedToday = 0;

  try {
    const now = new Date();
    const todayStart = now.toISOString().split('T')[0] + 'T00:00:00';

    // Count missions with status='in_progress'
    activeMissions = getMissions({ status: 'in_progress' }).length;

    // Count steps with status='pending'
    queuedSteps = getSteps({ status: 'pending' }).length;

    // Count steps with status='in_progress'
    runningSteps = getSteps({ status: 'in_progress' }).length;

    // Count proposals with status='pending'
    pendingProposals = getProposals({ status: 'pending' }).length;

    // Count missions completed today
    const completedMissions = getMissions({ status: 'completed' });
    completedToday = completedMissions.filter(
      (m) => m.completed_at && m.completed_at >= todayStart
    ).length;
  } catch (err) {
    console.error('Error getting ops counts:', err);
  }

  return {
    status: 'GREEN',
    uptime: time.uptime,
    cpu: Math.round(cpu.currentLoad),
    ram: Math.round((mem.used / mem.total) * 100),
    disk: diskUsage,
    activeAgents: getAgentCount(),
    totalTasks,
    openComms: getCommsCount(),
    lastWebhook: lastWebhookTime,
    activeMissions,
    queuedSteps,
    pendingProposals,
    runningSteps,
    completedToday,
    workerAlive: checkHeartbeat('/home/slimy/ned-clawd/ops/worker-heartbeat.txt'),
    heartbeatAlive: checkHeartbeat('/home/slimy/ned-clawd/ops/heartbeat-pulse.txt'),
  };
}
