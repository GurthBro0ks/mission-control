import { NextResponse } from 'next/server';
import { fileStore } from '@/lib/fileStore';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    const body = await request.json();
    
    const calendar = fileStore.readCalendar();
    const eventIndex = calendar.events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    const event = calendar.events[eventIndex];
    
    if (body.title !== undefined) event.title = body.title;
    if (body.description !== undefined) event.description = body.description;
    if (body.schedule !== undefined) event.schedule = body.schedule;
    if (body.frequency !== undefined) event.frequency = body.frequency;
    if (body.enabled !== undefined) event.enabled = body.enabled;
    if (body.type !== undefined) event.type = body.type;
    if (body.date !== undefined || body.time !== undefined) {
      const date = body.date || event.next_run?.split('T')[0];
      const time = body.time || event.next_run?.split('T')[1]?.split('.')[0] || '00:00';
      event.next_run = `${date}T${time}:00Z`;
    }
    
    calendar.last_updated = new Date().toISOString();
    fileStore.writeCalendar(calendar);
    
    return NextResponse.json(calendar);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id);
    
    const calendar = fileStore.readCalendar();
    const eventIndex = calendar.events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    
    calendar.events.splice(eventIndex, 1);
    calendar.last_updated = new Date().toISOString();
    
    fileStore.writeCalendar(calendar);
    
    return NextResponse.json(calendar);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
