import { NextResponse } from 'next/server';
import { fileStore, CalendarEvent, Calendar } from '@/lib/fileStore';
import { execSync } from 'child_process';
import { addMessage } from '@/lib/db';
import { appEmitter } from '@/lib/events';

interface CalendarWithCrons extends Calendar {
  crons: CalendarEvent[];
}

// Check and fire events that match current time
async function checkAndFireEvents() {
  const calendar = fileStore.readCalendar();
  const now = new Date();
  const currentTime = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  let modified = false;

  for (const event of calendar.events) {
    if (!event.enabled || event.fired) continue;
    if (!event.next_run) continue;

    const eventTime = event.next_run.slice(0, 16);
    if (eventTime === currentTime) {
      // Fire the event
      event.fired = true;
      modified = true;

      // Check for ping/@mention patterns
      if (event.title.toLowerCase().includes('ping') || event.title.includes('@')) {
        // Extract mention or use title as message
        const mentionMatch = event.title.match(/@(\w+)/);
        const targetAgent = mentionMatch ? mentionMatch[1] : 'all';
        const message = event.description || event.title;

        // Bug 4 fix: Use direct function calls instead of HTTP self-call
        try {
          addMessage('System', targetAgent, message, 'notifications');
          appEmitter.emit('message', {
            from_agent: 'System',
            to_agent: targetAgent,
            message: message,
            channel: 'notifications',
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Failed to post notification:', e);
        }
      }
    }
  }

  if (modified) {
    calendar.last_updated = now.toISOString();
    fileStore.writeCalendar(calendar);
  }
}

export async function GET() {
  try {
    // Check and fire events
    await checkAndFireEvents();

    const calendar = fileStore.readCalendar();

    // Get crontab entries
    const crons: CalendarEvent[] = [];
    try {
      const crontab = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
      const lines = crontab.split('\n').filter(line => 
        line.trim() && !line.startsWith('#') && !line.includes('# ===')
      );
      
      let id = 1000;
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const schedule = parts.slice(0, 5).join(' ');
          const command = parts.slice(5).join(' ');
          
          // Try to infer frequency
          let frequency = 'custom';
          if (schedule.includes('* * * * *')) frequency = 'every minute';
          else if (schedule.startsWith('*/')) frequency = `every ${schedule.slice(2)} minutes`;
          else if (schedule.startsWith('0 * * * *')) frequency = 'hourly';
          else if (schedule.startsWith('0 0 * * *')) frequency = 'daily';
          else if (schedule.startsWith('0 8 * * 0')) frequency = 'weekly';
          
          crons.push({
            id: id++,
            title: command.split('/').pop()?.split('.')[0] || 'Cron Job',
            description: command,
            schedule,
            frequency,
            next_run: new Date().toISOString(),
            enabled: true,
            type: 'system',
            status: 'active',
          });
        }
      });
    } catch (e) {
      // Crontab not available
    }
    
    const result: CalendarWithCrons = { ...calendar, crons };
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read calendar' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, schedule, frequency, type, enabled, date, time } = body;
    
    const calendar = fileStore.readCalendar();
    
    const newId = calendar.events.length > 0 
      ? Math.max(...calendar.events.map(e => e.id)) + 1 
      : 1;
    
    const now = new Date().toISOString();
    
    const newEvent: CalendarEvent = {
      id: newId,
      title,
      description: description || '',
      schedule: schedule || '',
      frequency: frequency || 'one-time',
      next_run: date ? `${date}T${time || '00:00'}:00Z` : now,
      enabled: enabled ?? true,
      type: type || 'event',
      status: 'active',
    };
    
    calendar.events.push(newEvent);
    calendar.last_updated = now;
    fileStore.writeCalendar(calendar);
    
    return NextResponse.json(calendar);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
