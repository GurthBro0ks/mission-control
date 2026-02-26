import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { getSystemHealth } from '@/lib/system';

export async function GET() {
  try {
    // Get base health from system.ts (includes ops data)
    const health = await getSystemHealth();

    // Override CPU, RAM, DISK with fresh shell commands
    try {
      const cpuOut = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'", { encoding: 'utf8' });
      health.cpu = parseFloat(cpuOut.trim()) || health.cpu;
    } catch {}

    try {
      const ramOut = execSync("free -m | awk '/Mem:/ {printf \"%.0f\", $3/$2*100}'", { encoding: 'utf8' });
      health.ram = parseInt(ramOut.trim(), 10) || health.ram;
    } catch {}

    try {
      const diskOut = execSync("df / | tail -1 | awk '{gsub(/%/,\"\"); print $5}'", { encoding: 'utf8' });
      health.disk = parseInt(diskOut.trim(), 10) || health.disk;
    } catch {}

    return NextResponse.json(health, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get system health' },
      { status: 500 }
    );
  }
}
