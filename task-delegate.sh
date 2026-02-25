#!/bin/bash
# Usage: task-delegate.sh <task_id> <delegated_to> [reason]
SECRET="slimyai-mc-2026"
TASK_ID="$1"
DELEGATED_TO="$2"
REASON="${3:-}"

if [ -z "$TASK_ID" ] || [ -z "$DELEGATED_TO" ]; then
  echo "Usage: task-delegate.sh <task_id> <delegated_to> [reason]"
  exit 1
fi

curl -s -X POST http://localhost:3838/api/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  --data-binary "$(jq -n \
    --argjson task_id "$TASK_ID" \
    --arg delegated_to "$DELEGATED_TO" \
    --arg reason "$REASON" \
    '{type: "task_delegate", data: {task_id: $task_id, delegated_to: $delegated_to, reason: $reason}}')"
echo ""
