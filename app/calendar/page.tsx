"use client";

import { useState, useEffect } from 'react';

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  schedule: string;
  frequency: string;
  next_run: string;
  enabled: boolean;
  type: string;
  status: string;
}

interface CronEntry {
  index: number;
  schedule: string;
  command: string;
  enabled: boolean;
  humanReadable: string;
}

interface CalendarData {
  events: CalendarEvent[];
  crons: CalendarEvent[];
}

const AGENT_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];

const PRESETS = [
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Daily at noon', value: '0 12 * * *' },
  { label: 'Weekly on Monday', value: '0 0 * * 1' },
  { label: 'Weekly on Friday', value: '0 0 * * 5' },
  { label: 'Monthly', value: '0 0 1 * *' },
];

export default function CalendarPage() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [crons, setCrons] = useState<CronEntry[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedCron, setSelectedCron] = useState<CronEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCronModal, setShowCronModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '09:00',
    frequency: 'one-time',
    agent: 'ned',
    color: AGENT_COLORS[0],
    type: 'event',
  });
  const [cronFormData, setCronFormData] = useState({
    schedule: '0 0 * * *',
    command: '',
    minute: '0',
    hour: '0',
    dom: '*',
    month: '*',
    dow: '*',
  });

  useEffect(() => {
    fetchCalendar();
    fetchCrons();
  }, []);

  const fetchCalendar = async () => {
    const res = await fetch('/api/calendar');
    const calendarData = await res.json();
    setData(calendarData);
  };

  const fetchCrons = async () => {
    const res = await fetch('/api/cron');
    const cronData = await res.json();
    setCrons(cronData.crons || []);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getEventsForDay = (day: number) => {
    if (!data) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const events = [...data.events, ...data.crons].filter(e => {
      if (!e.next_run) return false;
      return e.next_run.startsWith(dateStr);
    });
    return events;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() &&
           currentDate.getMonth() === today.getMonth() &&
           currentDate.getFullYear() === today.getFullYear();
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPrefillDate(dateStr);
    setFormData({ ...formData, date: dateStr });
    setShowAddModal(true);
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
  };

  const handleSave = async () => {
    if (!selectedEvent || selectedEvent.id < 1000) {
      await fetch(`/api/calendar/${selectedEvent?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedEvent?.title,
          description: selectedEvent?.description,
          frequency: selectedEvent?.frequency,
          date: selectedEvent?.next_run?.split('T')[0],
          time: selectedEvent?.next_run?.split('T')[1]?.slice(0, 5),
        }),
      });
    }
    setSelectedEvent(null);
    fetchCalendar();
  };

  const handleDelete = async () => {
    if (selectedEvent && selectedEvent.id < 1000) {
      await fetch(`/api/calendar/${selectedEvent.id}`, { method: 'DELETE' });
    }
    setSelectedEvent(null);
    fetchCalendar();
  };

  const handleCreate = async () => {
    await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        frequency: formData.frequency,
        type: formData.type || 'event',
      }),
    });
    setShowAddModal(false);
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '09:00',
      frequency: 'one-time',
      agent: 'ned',
      color: AGENT_COLORS[0],
      type: 'event',
    });
    fetchCalendar();
  };

  // Cron handlers
  const handleAddCron = async () => {
    const schedule = `${cronFormData.minute} ${cronFormData.hour} ${cronFormData.dom} ${cronFormData.month} ${cronFormData.dow}`;
    await fetch('/api/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule,
        command: cronFormData.command,
      }),
    });
    setShowCronModal(false);
    setCronFormData({
      schedule: '0 0 * * *',
      command: '',
      minute: '0',
      hour: '0',
      dom: '*',
      month: '*',
      dow: '*',
    });
    fetchCrons();
  };

  const handleUpdateCron = async () => {
    if (!selectedCron) return;
    const schedule = `${cronFormData.minute} ${cronFormData.hour} ${cronFormData.dom} ${cronFormData.month} ${cronFormData.dow}`;
    await fetch(`/api/cron/${selectedCron.index}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule,
        command: cronFormData.command,
      }),
    });
    setSelectedCron(null);
    fetchCrons();
  };

  const handleDeleteCron = async () => {
    if (!selectedCron) return;
    await fetch(`/api/cron/${selectedCron.index}`, {
      method: 'DELETE',
    });
    setSelectedCron(null);
    fetchCrons();
  };

  const openEditCron = (cron: CronEntry) => {
    const parts = cron.schedule.split(/\s+/);
    setCronFormData({
      schedule: cron.schedule,
      command: cron.command,
      minute: parts[0] || '*',
      hour: parts[1] || '*',
      dom: parts[2] || '*',
      month: parts[3] || '*',
      dow: parts[4] || '*',
    });
    setSelectedCron(cron);
  };

  const applyPreset = (preset: string) => {
    const parts = preset.split(/\s+/);
    setCronFormData({
      ...cronFormData,
      schedule: preset,
      minute: parts[0] || '*',
      hour: parts[1] || '*',
      dom: parts[2] || '*',
      month: parts[3] || '*',
      dow: parts[4] || '*',
    });
  };

  const allEvents = data ? [...data.events, ...data.crons]
    .filter(e => e.next_run)
    .sort((a, b) => new Date(a.next_run).getTime() - new Date(b.next_run).getTime()) : [];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} style={{ minHeight: '80px', background: '#0a0a0f22' }} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = getEventsForDay(day);
    days.push(
      <div
        key={day}
        onClick={() => handleDayClick(day)}
        style={{
          minHeight: '80px',
          background: isToday(day) ? '#22d3ee11' : '#0a0a0f',
          border: isToday(day) ? '1px solid #22d3ee' : '1px solid #1a1a2e',
          borderRadius: '4px',
          padding: '4px',
          cursor: 'pointer',
        }}
      >
        <div style={{
          fontSize: '12px',
          color: isToday(day) ? '#22d3ee' : '#6b7280',
          fontWeight: isToday(day) ? 'bold' : 'normal',
          marginBottom: '4px',
        }}>
          {day}
        </div>
        {dayEvents.slice(0, 3).map((event, idx) => (
          <div
            key={event.id}
            onClick={(e) => handleEventClick(event, e)}
            style={{
              fontSize: '8px',
              padding: '2px 4px',
              marginBottom: '2px',
              background: '#1a1a2e',
              borderRadius: '3px',
              borderLeft: `3px solid ${event.type === 'system' ? '#f59e0b' : '#22c55e'}`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {event.type === 'system' ? '↻ ' : ''}{event.title}
          </div>
        ))}
        {dayEvents.length > 3 && (
          <div style={{ fontSize: '8px', color: '#6b7280' }}>+{dayEvents.length - 3} more</div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handlePrevMonth}
            style={{ background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#22d3ee', margin: 0, minWidth: '200px', textAlign: 'center' }}>
            📅 {formatMonth(currentDate)}
          </h1>
          <button
            onClick={handleNextMonth}
            style={{ background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
          >
            →
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setPrefillDate(''); setFormData({ ...formData, type: 'event' }); setShowAddModal(true); }}
            style={{ background: '#22d3ee', border: 'none', color: '#000', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add Event
          </button>
          <button
            onClick={() => { setPrefillDate(''); setFormData({ ...formData, type: 'reminder' }); setShowAddModal(true); }}
            style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Add Reminder
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '24px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontSize: '12px', fontWeight: 'bold' }}>
            {day}
          </div>
        ))}
        {days}
      </div>

      {/* All Events List */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '16px' }}>All Events</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allEvents.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>No events scheduled</div>
          ) : (
            allEvents.map(event => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${event.type === 'system' ? '#f59e0b' : '#22c55e'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{event.title}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {event.next_run ? new Date(event.next_run).toLocaleString() : 'N/A'} · {event.frequency}
                  </div>
                </div>
                {event.type === 'system' && (
                  <span style={{ fontSize: '10px', background: '#f59e0b22', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px' }}>
                    System Cron
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Scheduled Jobs Section */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#22d3ee', margin: 0 }}>
            ⏰ Scheduled Jobs
          </h2>
          <button
            onClick={() => { setCronFormData({ schedule: '0 0 * * *', command: '', minute: '0', hour: '0', dom: '*', month: '*', dow: '*' }); setShowCronModal(true); }}
            style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            + Add Cron Job
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {crons.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px', background: '#0a0a0f', borderRadius: '8px', border: '1px solid #1a1a2e' }}>
              No cron jobs configured
            </div>
          ) : (
            crons.map(cron => (
              <div
                key={cron.index}
                onClick={() => openEditCron(cron)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '20px' }}>⏰</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{cron.humanReadable}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                    {cron.command}
                  </div>
                </div>
                <span style={{ fontSize: '10px', background: '#1a1a2e', color: '#9ca3af', padding: '2px 8px', borderRadius: '4px' }}>
                  {cron.schedule}
                </span>
                <span style={{ color: '#6b7280' }}>→</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: '8px', padding: '24px', width: '400px' }}
          >
            <h2 style={{ color: '#22d3ee', marginBottom: '20px', marginTop: 0 }}>
              {selectedEvent.type === 'system' ? '🔧 System Cron' : 'Edit Event'}
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Title</label>
              <input
                type="text"
                value={selectedEvent.title}
                onChange={e => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                disabled={selectedEvent.type === 'system'}
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
              />
            </div>

            {selectedEvent.type === 'system' && (
              <div style={{ marginBottom: '16px', padding: '8px', background: '#1a1a2e', borderRadius: '4px', fontSize: '12px', color: '#6b7280' }}>
                <div>Schedule: {selectedEvent.schedule || selectedEvent.frequency}</div>
                <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>{selectedEvent.description}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Date</label>
                <input
                  type="date"
                  value={selectedEvent.next_run?.split('T')[0] || ''}
                  onChange={e => setSelectedEvent({ ...selectedEvent, next_run: `${e.target.value}T00:00:00Z` })}
                  disabled={selectedEvent.type === 'system'}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Time</label>
                <input
                  type="time"
                  value={selectedEvent.next_run?.split('T')[1]?.slice(0, 5) || ''}
                  onChange={e => setSelectedEvent({ ...selectedEvent, next_run: `${selectedEvent.next_run?.split('T')[0]}T${e.target.value}:00Z` })}
                  disabled={selectedEvent.type === 'system'}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {selectedEvent.type !== 'system' && (
                <>
                  <button onClick={handleSave} style={{ flex: 1, background: '#22d3ee', border: 'none', color: '#000', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Save
                  </button>
                  <button onClick={handleDelete} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    Delete
                  </button>
                </>
              )}
              <button onClick={() => setSelectedEvent(null)} style={{ flex: 1, background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: '8px', padding: '24px', width: '400px' }}
          >
            <h2 style={{ color: '#22d3ee', marginBottom: '20px', marginTop: 0 }}>Add Event</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Title</label>
              <input
                type="text"
                autoFocus
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Event title..."
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event description..."
                rows={2}
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Date</label>
                <input
                  type="date"
                  value={formData.date || prefillDate}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Frequency</label>
              <select
                value={formData.frequency}
                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
              >
                <option value="one-time">One-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCreate}
                disabled={!formData.title || !formData.date}
                style={{ flex: 1, background: formData.title && formData.date ? '#22d3ee' : '#1a1a2e', border: 'none', color: formData.title && formData.date ? '#000' : '#6b7280', padding: '10px', borderRadius: '6px', cursor: formData.title && formData.date ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
              >
                Add Event
              </button>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cron Job Modal */}
      {(showCronModal || selectedCron) && (
        <div
          onClick={() => { setShowCronModal(false); setSelectedCron(null); }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0a0a0f', border: '1px solid #1a1a2e', borderRadius: '8px', padding: '24px', width: '500px' }}
          >
            <h2 style={{ color: '#f59e0b', marginBottom: '20px', marginTop: 0 }}>
              {selectedCron ? 'Edit Cron Job' : 'Add Cron Job'}
            </h2>

            {/* Presets */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>Quick Presets</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => applyPreset(preset.value)}
                    style={{
                      background: cronFormData.schedule === preset.value ? '#f59e0b' : '#1a1a2e',
                      border: 'none',
                      color: cronFormData.schedule === preset.value ? '#000' : '#e2e8f0',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>Minute</label>
                <input
                  type="text"
                  value={cronFormData.minute}
                  onChange={e => setCronFormData({ ...cronFormData, minute: e.target.value, schedule: `${e.target.value} ${cronFormData.hour} ${cronFormData.dom} ${cronFormData.month} ${cronFormData.dow}` })}
                  placeholder="*"
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>Hour</label>
                <input
                  type="text"
                  value={cronFormData.hour}
                  onChange={e => setCronFormData({ ...cronFormData, hour: e.target.value, schedule: `${cronFormData.minute} ${e.target.value} ${cronFormData.dom} ${cronFormData.month} ${cronFormData.dow}` })}
                  placeholder="*"
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>Day (Month)</label>
                <input
                  type="text"
                  value={cronFormData.dom}
                  onChange={e => setCronFormData({ ...cronFormData, dom: e.target.value, schedule: `${cronFormData.minute} ${cronFormData.hour} ${e.target.value} ${cronFormData.month} ${cronFormData.dow}` })}
                  placeholder="*"
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>Month</label>
                <input
                  type="text"
                  value={cronFormData.month}
                  onChange={e => setCronFormData({ ...cronFormData, month: e.target.value, schedule: `${cronFormData.minute} ${cronFormData.hour} ${cronFormData.dom} ${e.target.value} ${cronFormData.dow}` })}
                  placeholder="*"
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>Day (Week)</label>
                <input
                  type="text"
                  value={cronFormData.dow}
                  onChange={e => setCronFormData({ ...cronFormData, dow: e.target.value, schedule: `${cronFormData.minute} ${cronFormData.hour} ${cronFormData.dom} ${cronFormData.month} ${e.target.value}` })}
                  placeholder="*"
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px', padding: '8px', background: '#1a1a2e', borderRadius: '4px', fontSize: '12px', color: '#f59e0b', fontFamily: 'monospace', textAlign: 'center' }}>
              {cronFormData.schedule}
            </div>

            {/* Command */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Command</label>
              <input
                type="text"
                autoFocus
                value={cronFormData.command}
                onChange={e => setCronFormData({ ...cronFormData, command: e.target.value })}
                placeholder="/path/to/script.sh"
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={selectedCron ? handleUpdateCron : handleAddCron}
                disabled={!cronFormData.command}
                style={{ flex: 1, background: cronFormData.command ? '#f59e0b' : '#1a1a2e', border: 'none', color: cronFormData.command ? '#000' : '#6b7280', padding: '10px', borderRadius: '6px', cursor: cronFormData.command ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
              >
                {selectedCron ? 'Update' : 'Add'} Cron Job
              </button>
              {selectedCron && (
                <button
                  onClick={handleDeleteCron}
                  style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
              <button onClick={() => { setShowCronModal(false); setSelectedCron(null); }} style={{ flex: 1, background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
