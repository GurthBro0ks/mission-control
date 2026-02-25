#!/bin/bash
# Usage: task-progress.sh <task_id> <progress 0-100>
SECRET="slimyai-mc-2026"
TASK_ID="$1"
PROGRESS="$2"

if [ -z "$TASK_ID" ] || [ -z "$PROGRESS" ]; then
  echo "Usage: task-progress.sh <task_id> <progress 0-100>"
  exit 1
fi

curl -s -X POST http://localhost:3838/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  --data-binary "$(jq -n \
    --argjson task_id "$TASK_ID" \
    --argjson progress "$PROGRESS" \
    '{type: "task_progress", data: {task_id: $task_id, progress: $progress}}')"
echo ""
