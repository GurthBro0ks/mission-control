#!/bin/bash
# Usage: task-create.sh <title> [description] [assignee] [priority]
SECRET="slimyai-mc-2026"
TITLE="$1"
DESC="${2:-}"
ASSIGNEE="${3:-ned}"
PRIORITY="${4:-medium}"

if [ -z "$TITLE" ]; then
  echo "Usage: task-create.sh <title> [description] [assignee] [priority]"
  exit 1
fi

curl -s -X POST http://localhost:3838/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  --data-binary "$(jq -n \
    --arg title "$TITLE" \
    --arg desc "$DESC" \
    --arg assignee "$ASSIGNEE" \
    --arg priority "$PRIORITY" \
    '{type: "task_create", data: {title: $title, description: $desc, assignee: $assignee, priority: $priority}}')"
echo ""
