#!/bin/bash
# Task Board CLI

TASK_FILE="/home/slimy/ned-clawd/tasks/taskboard.json"

show_board() {
    echo "============================================"
    echo "  NED & GURTH TASK BOARD"
    echo "============================================"
    echo ""
    
    echo "📋 TODO (Assigned to Gurth):"
    jq -r '.tasks[] | select(.status == "todo" and .assignee == "gurth") | "  [\( .id )] \( .title ) - \( .priority )"' "$TASK_FILE"
    echo ""
    
    echo "📋 TODO (Assigned to Ned):"
    jq -r '.tasks[] | select(.status == "todo" and .assignee == "ned") | "  [\( .id )] \( .title ) - \( .priority )"' "$TASK_FILE"
    echo ""
    
    echo "🔄 IN PROGRESS:"
    jq -r '.tasks[] | select(.status == "in_progress") | "  [\( .id )] \( .title ) (\( .assignee )) - \( .priority )"' "$TASK_FILE"
    echo ""
    
    echo "✅ DONE:"
    jq -r '.tasks[] | select(.status == "done") | "  [\( .id )] \( .title ) - \( .priority )"' "$TASK_FILE"
    echo ""
    echo "============================================"
}

add_task() {
    local title="$1"
    local desc="$2"
    local assignee="$3"
    local priority="${4:-medium}"
    
    local id=$(jq '.tasks | length + 1' "$TASK_FILE")
    local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    jq --arg id "$id" --arg title "$title" --arg desc "$desc" --arg assignee "$assignee" --arg priority "$priority" --arg now "$now" \
        '.tasks += [{"id": ($id | tonumber), "title": $title, "description": $desc, "status": "todo", "assignee": $assignee, "priority": $priority, "created_at": $now, "updated_at": $now}] | .last_updated = $now' \
        "$TASK_FILE" > /tmp/taskboard.json && mv /tmp/taskboard.json "$TASK_FILE"
    
    echo "Added: [$id] $title (assigned: $assignee)"
}

update_status() {
    local id="$1"
    local status="$2"
    local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    jq --arg id "$id" --arg status "$status" --arg now "$now" \
        '.tasks[] | select(.id == ($id | tonumber)) | .status = $status | .updated_at = $now' \
        "$TASK_FILE" > /tmp/taskboard.json && mv /tmp/taskboard.json "$TASK_FILE"
    
    echo "Updated task #$id to $status"
}

case "$1" in
    show)
        show_board
        ;;
    add)
        add_task "$2" "$3" "$4" "$5"
        ;;
    done)
        update_status "$2" "done"
        ;;
    progress)
        update_status "$2" "in_progress"
        ;;
    todo)
        update_status "$2" "todo"
        ;;
    *)
        show_board
        ;;
esac
