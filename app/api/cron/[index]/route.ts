import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
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

  if (minute.startsWith('*/')) {
    const mins = minute.slice(2);
    return `Every ${mins} minutes`;
  }

  if (minute === '0' && hour.startsWith('*/')) {
    const hours = hour.slice(2);
    return `Every ${hours} hours`;
  }

  if (minute !== '*' && hour !== '*' && dom === '*' && month === '*' && dow === '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `Daily at ${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

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

      if (!trimmed || trimmed.startsWith('#')) {
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
    // Crontab is empty
  }

  return entries;
}

function backupCrontab(): string {
  const backupDir = '/home/slimy/backups';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = Date.now();
  const backupFile = path.join(backupDir, `crontab-${timestamp}.bak`);

  try {
    const currentCrontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
    fs.writeFileSync(backupFile, currentCrontab);
    return backupFile;
  } catch (e) {
    return '';
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ index: string }> }
) {
  try {
    const { index: indexStr } = await params;
    const index = parseInt(indexStr);

    if (isNaN(index)) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    const body = await request.json();
    const { schedule, command } = body;

    // Bug 5 fix: Validate input to prevent shell injection
    if ((schedule && !validateCronField(schedule)) || (command && !validateCronField(command))) {
      return NextResponse.json({ error: 'Invalid characters in input' }, { status: 400 });
    }

    // Backup first
    backupCrontab();

    // Get current crontab
    let crontab = '';
    try {
      crontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
    } catch (e) {
      return NextResponse.json({ error: 'No crontab found' }, { status: 400 });
    }

    const lines = crontab.split('\n');
    const newLines: string[] = [];
    let lineIndex = 0;
    let entryIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 6) {
        if (entryIndex === index) {
          // Replace this entry
          const newSchedule = schedule || parts.slice(0, 5).join(' ');
          const newCommand = command || parts.slice(5).join(' ');
          newLines.push(`${newSchedule} ${newCommand}`);
        } else {
          newLines.push(line);
        }
        entryIndex++;
      } else {
        newLines.push(line);
      }
      lineIndex++;
    }

    const newCrontab = newLines.join('\n') + '\n';
    // Bug 5 fix: Use temp file instead of shell interpolation
    writeCrontab(newCrontab);

    const crons = parseCrontab();
    return NextResponse.json({ crons, message: 'Cron job updated successfully' });
  } catch (error) {
    console.error('Cron PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update cron job' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ index: string }> }
) {
  try {
    const { index: indexStr } = await params;
    const index = parseInt(indexStr);

    if (isNaN(index)) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    // Backup first
    backupCrontab();

    // Get current crontab
    let crontab = '';
    try {
      crontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
    } catch (e) {
      return NextResponse.json({ error: 'No crontab found' }, { status: 400 });
    }

    const lines = crontab.split('\n');
    const newLines: string[] = [];
    let entryIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 6) {
        if (entryIndex !== index) {
          newLines.push(line);
        }
        entryIndex++;
      } else {
        newLines.push(line);
      }
    }

    const newCrontab = newLines.join('\n') + '\n';
    // Bug 5 fix: Use temp file instead of shell interpolation
    writeCrontab(newCrontab);

    const crons = parseCrontab();
    return NextResponse.json({ crons, message: 'Cron job deleted successfully' });
  } catch (error) {
    console.error('Cron DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete cron job' }, { status: 500 });
  }
}
