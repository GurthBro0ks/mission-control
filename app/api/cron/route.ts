import { NextResponse } from 'next/server';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Bug 5 fix: Input validation to prevent shell injection
function validateCronField(field: string): boolean {
  const dangerous = /[`$;|&><\n\r]/;
  return !dangerous.test(field);
}

// Bug 5 fix: Safe crontab write using temp file (no shell interpolation)
function writeCrontab(newContent: string): void {
  const tmpFile = path.join(tmpdir(), `crontab-${Date.now()}.tmp`);
  try {
    // Backup current crontab
    try {
      const current = execSync('crontab -l', { encoding: 'utf8' });
      fs.writeFileSync(`/home/slimy/backups/crontab-${Date.now()}.bak`, current);
    } catch { /* no existing crontab */ }

    // Write new crontab via temp file (no shell interpolation)
    fs.writeFileSync(tmpFile, newContent, 'utf8');
    execSync(`crontab ${tmpFile}`, { encoding: 'utf8' });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* cleanup */ }
  }
}

interface CronEntry {
  index: number;
  schedule: string;
  command: string;
  enabled: boolean;
  humanReadable: string;
}

function cronToHumanReadable(schedule: string): string {
  const parts = schedule.split(/\s+/);
  if (parts.length < 5) return schedule;

  const [minute, hour, dom, month, dow] = parts;

  // Every X minutes
  if (minute.startsWith('*/')) {
    const mins = minute.slice(2);
    return `Every ${mins} minutes`;
  }

  // Every X hours
  if (minute === '0' && hour.startsWith('*/')) {
    const hours = hour.slice(2);
    return `Every ${hours} hours`;
  }

  // Daily at specific time
  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `Daily at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  // Weekly
  if (dom === '*' && month === '*' && dow !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(dow);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      if (minute !== '*' && hour !== '*') {
        const h = parseInt(hour);
        const m = parseInt(minute);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `Weekly on ${days[dayNum]} at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      }
      return `Weekly on ${days[dayNum]}`;
    }
  }

  // Monthly
  if (dom !== '*' && month === '*' && dow === '*') {
    if (minute !== '*' && hour !== '*') {
      const h = parseInt(hour);
      const m = parseInt(minute);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `Monthly on day ${dom} at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
    return `Monthly on day ${dom}`;
  }

  // Hourly
  if (minute !== '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Hourly at minute ${minute}`;
  }

  return schedule;
}

function parseCrontab(): CronEntry[] {
  const entries: CronEntry[] = [];

  try {
    const crontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
    const lines = crontab.split('\n');

    let index = 0;
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        // Check if it's a disabled cron (commented out but has schedule)
        if (trimmed.startsWith('#') && /\d/.test(trimmed)) {
          // Could be disabled cron - skip for now
        }
        continue;
      }

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 6) {
        const schedule = parts.slice(0, 5).join(' ');
        const command = parts.slice(5).join(' ');

        entries.push({
          index,
          schedule,
          command,
          enabled: true,
          humanReadable: cronToHumanReadable(schedule),
        });
        index++;
      }
    }
  } catch (e) {
    // Crontab is empty or doesn't exist
  }

  return entries;
}

export async function GET() {
  try {
    const crons = parseCrontab();
    return NextResponse.json({ crons });
  } catch (error) {
    console.error('Cron API error:', error);
    return NextResponse.json({ error: 'Failed to read crons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schedule, command } = body;

    if (!schedule || !command) {
      return NextResponse.json({ error: 'Schedule and command are required' }, { status: 400 });
    }

    // Bug 5 fix: Validate input to prevent shell injection
    if (!validateCronField(schedule) || !validateCronField(command)) {
      return NextResponse.json({ error: 'Invalid characters in input' }, { status: 400 });
    }

    // Backup first
    const backupDir = '/home/slimy/backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = Date.now();
    const backupFile = path.join(backupDir, `crontab-${timestamp}.bak`);

    try {
      const currentCrontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
      fs.writeFileSync(backupFile, currentCrontab);
    } catch (e) {
      // No existing crontab, that's fine
    }

    // Add new cron entry
    const newEntry = `${schedule} ${command}`;
    let currentCrontab = '';

    try {
      currentCrontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
    } catch (e) {
      // Empty crontab
    }

    const newCrontab = currentCrontab.trim() + '\n' + newEntry + '\n';

    // Bug 5 fix: Use temp file instead of shell interpolation
    writeCrontab(newCrontab);

    const crons = parseCrontab();
    return NextResponse.json({ crons, message: 'Cron job added successfully' });
  } catch (error) {
    console.error('Cron API error:', error);
    return NextResponse.json({ error: 'Failed to add cron job' }, { status: 500 });
  }
}
