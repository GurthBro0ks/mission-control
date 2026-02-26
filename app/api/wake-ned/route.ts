import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';

export async function POST(): Promise<NextResponse> {
  try {
    const hookTokenPath = '/home/slimy/ned-clawd/.hook-token';
    const hookUrl = 'http://127.0.0.1:18789/hooks/agent';

    // Read token from file
    const token = (await fs.readFile(hookTokenPath, 'utf-8')).trim();

    const payload = JSON.stringify({ type: 'wake', source: 'manual_trigger' });

    // Log the wake action
    const logDir = '/home/slimy/ned-clawd/logs';
    const logFile = `${logDir}/ned-decisions.log`;
    try {
      await fs.mkdir(logDir, { recursive: true });
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [PROPOSAL_ID: N/A] - Decision: Manual wake triggered\n`;
      await fs.appendFile(logFile, logEntry);
    } catch (logErr) {
      console.error('[wake-ned] Failed to log:', logErr);
    }

    // Use curl to POST to the webhook endpoint
    return new Promise<NextResponse>((resolve) => {
      exec(
        `curl -s -X POST "${hookUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${payload.replace(/'/g, "'\\''")}'`,
        { timeout: 15000 },
        (err, stdout, stderr) => {
          if (err) {
            console.error('[wake-ned] Failed to notify Ned:', err.message);
            if (stderr) console.error('[wake-ned] curl stderr:', stderr);
            resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
          } else if (stdout) {
            console.log('[wake-ned] Ned notified:', stdout);
            resolve(NextResponse.json({ success: true, message: 'Ned notified' }));
          } else {
            resolve(NextResponse.json({ success: true, message: 'Ned notified' }));
          }
        }
      );
    });
  } catch (error) {
    console.error('[wake-ned] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to notify Ned' }, { status: 500 });
  }
}
