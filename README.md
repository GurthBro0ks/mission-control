# 🧪 SLIMYAI MISSION CONTROL

A retro-styled agent command center with real-time updates.

## 🚀 Quick Start

```bash
cd /home/slimy/mission-control
npm run start -- -p 3838
```

Visit: http://192.168.68.64:3838

## 📡 API Endpoints

### Health
```bash
curl http://localhost:3838/api/health
```

### Tasks
```bash
# Get all tasks
curl http://localhost:3838/api/tasks

# Get single task
curl http://localhost:3838/api/tasks/1

# Create task
curl -X POST http://localhost:3838/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"New task","status":"todo","priority":"medium"}'
```

### Agents
```bash
curl http://localhost:3838/api/agents
```

### Calendar
```bash
curl http://localhost:3838/api/calendar?month=2026-02
```

### Comms
```bash
# Get messages
curl http://localhost:3838/api/comms?limit=50

# Send message
curl -X POST http://localhost:3838/api/comms \
  -H "Content-Type: application/json" \
  -d '{"from":"Ned","to":"all","message":"Hello team!"}'
```

### Memory
```bash
# List files
curl http://localhost:3838/api/memory

# Search
curl "http://localhost:3838/api/memory?search=trading"

# Get file content
curl http://localhost:3838/api/memory/2026-02-18.md
```

## 🔗 Webhooks

### Endpoint
```
POST http://localhost:3838/api/webhook
Headers:
  Content-Type: application/json
  X-Webhook-Secret: slimyai-mc-2026
```

### Types

**comms** - Send agent message
```json
{
  "type": "comms",
  "data": {
    "from": "Ned",
    "to": "all",
    "message": "Task complete!"
  }
}
```

**agent_status** - Update agent status
```json
{
  "type": "agent_status",
  "agent": "Rex",
  "data": {
    "status": "working",
    "currentTask": "Fixing bugs"
  }
}
```

**task_update** - Update task status
```json
{
  "type": "task_update",
  "data": {
    "taskId": 1,
    "status": "complete",
    "assignee": "Ned"
  }
}
```

**system** - Log system metrics
```json
{
  "type": "system",
  "data": {
    "cpu": 45,
    "memory": 62,
    "disk": 71
  }
}
```

## 📺 Server-Sent Events (SSE)

Connect to `/api/sse` for real-time updates.

### Event Types

**file_change** - File modified
```json
{
  "type": "file_change",
  "file": "tasks/taskboard.json",
  "change": "change"
}
```

**new_message** - New comms message
```json
{
  "type": "new_message",
  "data": {
    "id": 1,
    "from_agent": "Ned",
    "message": "Hello!",
    "timestamp": "2026-02-18T12:00:00Z"
  }
}
```

**ping** - Keep-alive
```json
{
  "type": "ping"
}
```

## 🤖 Ned Integration

Add to your agent scripts:

```bash
# Notify Mission Control of comms
/home/slimy/ned-clawd/scripts/mc-notify.sh comms '{"from":"Ned","to":"all","message":"Done!"}'

# Update agent status
/home/slimy/ned-clawd/scripts/mc-notify.sh agent_status '{"agent":"Ned","status":"working","task":"Coding"}'

# Update task
/home/slimy/ned-clawd/scripts/mc-notify.sh task_update '{"taskId":1,"status":"done"}'
```

Or set the env var:
```bash
export WEBHOOK_SECRET=slimyai-mc-2026
```

## 🎨 UI Pages

| Path | Description |
|------|-------------|
| `/` | Pixel art office with animated agents |
| `/tasks` | Interactive task board |
| `/calendar` | Visual calendar with events |
| `/comms` | AIM-style agent messenger |
| `/memory` | Searchable memory bank |

## ⚙️ Environment Variables

```env
WEBHOOK_SECRET=slimyai-mc-2026
```

## 🔧 Development

```bash
# Dev mode (slower but hot reload)
npm run dev -- -p 3838

# Production build
npm run build
npm run start -- -p 3838
```

## 🆕 Phases 6-14: Post-Launch Enhancements

### Ops Control Center (/ops)
The main mission orchestration interface featuring:
- **Proposal Management**: Create and manage mission proposals
- **Mission Tracking**: Real-time mission status with progress bars
- **Step Management**: View individual steps with retry capability
- **Wake Ned**: Trigger Ned to process pending proposals

### Visualizations
- **DAG View**: Toggle between list and graph visualization of mission steps

### Quality Gates
- **Review Gates**: Approve/reject buttons for implement, deploy, refactor steps
- **Review Notes**: Add notes when rejecting steps

### Planning Features
- **Deliberation Phase**: Board Meeting for complex missions
- **Context Packets**: Design docs passed to agents as context

### Safety Features
- **File Locking**: Prevents race conditions when multiple agents edit same files

### Automation
- **Scheduler**: Daily automated tasks (e.g., Pip's Market Brief)
- **Trigger via UI**: Manual trigger button for daily brief

### Notifications
- **Discord Integration**: Real-time mission updates to Discord channel
- **SSE Events**: Real-time UI updates via Server-Sent Events

### API Endpoints (New)

```bash
# Ops - Proposals
GET/POST /api/ops/proposals

# Ops - Missions
GET /api/ops/missions

# Ops - Steps
PATCH /api/ops/steps/[id]

# Scheduler
POST /api/scheduler/daily-brief
Headers: X-Scheduler-Secret: slimyai-mc-2026

# Discord Test
POST /api/discord/test
```

### Environment Variables

```env
# Required
WEBHOOK_SECRET=slimyai-mc-2026

# Optional - Discord Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Optional - Scheduler
SCHEDULER_SECRET=slimyai-mc-2026
```

### UI Pages (Updated)

| Path | Description |
|------|-------------|
| `/ops` | Mission control center (NEW) |
| `/` | Pixel art office with animated agents |
| `/tasks` | Interactive task board |
| `/calendar` | Visual calendar with events |
| `/comms` | AIM-style agent messenger |
| `/memory` | Searchable memory bank |
