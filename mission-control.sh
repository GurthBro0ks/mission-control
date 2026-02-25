#!/bin/bash
# Mission Control - Central Dashboard
# Ned & Gurth's Command Center

SCRIPT_DIR="/home/slimy/ned-clawd/scripts"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║     █████╗  ██████╗ ██████╗███████╗███████╗███████╗                ║"
echo "║    ██╔══██╗██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝                ║"
echo "║    ███████║██║     ██║     █████╗  ███████╗███████╗                ║"
echo "║    ██╔══██║██║     ██║     ██╔══╝  ╚════██║╚════██║                ║"
echo "║    ██║  ██║╚██████╗╚██████╗███████╗███████║███████║                ║"
echo "║    ╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚══════╝╚══════╝╚══════╝                ║"
echo "║                                        MISSION CONTROL               ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# System Health
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  🚀 SYSTEM STATUS"
echo "├──────────────────────────────────────────────────────────────────────┤"

disk_pct=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
echo "│  💾 Disk: ${disk_pct}% used"

mem_used=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
echo "│  🧠 Memory: ${mem_used}% used"

load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
echo "│  ⚡ Load: $load"

zombies=$(ps aux | grep -c '[Z]' 2>/dev/null || echo 0)
echo "│  🧟 Zombies: $zombies"

if pgrep -f "openclaw" > /dev/null 2>&1; then
    echo "│  🌐 Gateway: Running"
else
    echo "│  🌐 Gateway: Stopped"
fi

echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

# Task Board Summary
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  📋 TASKS"
echo "├──────────────────────────────────────────────────────────────────────┤"

todo_ned=$(jq '[.tasks[] | select(.status == "todo" and .assignee == "ned")] | length' /home/slimy/ned-clawd/tasks/taskboard.json)
todo_gurth=$(jq '[.tasks[] | select(.status == "todo" and .assignee == "gurth")] | length' /home/slimy/ned-clawd/tasks/taskboard.json)
in_progress=$(jq '[.tasks[] | select(.status == "in_progress")] | length' /home/slimy/ned-clawd/tasks/taskboard.json)
done_count=$(jq '[.tasks[] | select(.status == "done")] | length' /home/slimy/ned-clawd/tasks/taskboard.json)

echo "│  Ned's TODO:    $todo_ned"
echo "│  Gurth's TODO:  $todo_gurth"
echo "│  In Progress:   $in_progress"
echo "│  Completed:     $done_count"
echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

# Calendar Summary
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  📅 SCHEDULED TASKS"
echo "├──────────────────────────────────────────────────────────────────────┤"

jq -r '.events[] | select(.enabled == true) | 
"│  [\(.id)] \(.title) - \(.frequency)"' /home/slimy/ned-clawd/calendar/calendar.json

echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

# Content Pipeline Summary
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  📝 CONTENT PIPELINE"
echo "├──────────────────────────────────────────────────────────────────────┤"

for stage in ideas outlines scripts media review published; do
    count=$(jq --arg stage "$stage" '[.items[] | select(.stage == $stage)] | length' /home/slimy/ned-clawd/content/pipeline.json)
    echo "│  $stage: $count"
done

echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

# Team Summary
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  👥 TEAM"
echo "├──────────────────────────────────────────────────────────────────────┤"

active_count=$(jq '[.agents[] | select(.status == "active")] | length' /home/slimy/ned-clawd/team/team.json)
available_count=$(jq '[.agents[] | select(.status == "available")] | length' /home/slimy/ned-clawd/team/team.json)

echo "│  Active:     $active_count"
echo "│  Available:  $available_count"
echo "│  Total:      $(jq '.agents | length' /home/slimy/ned-clawd/team/team.json)"

echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

# Quick Commands
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  ⚡ QUICK COMMANDS"
echo "├──────────────────────────────────────────────────────────────────────┤"
echo "│  Task Board:    ./scripts/taskboard.sh show"
echo "│  Calendar:      ./scripts/calendar.sh show"
echo "│  Content:      ./scripts/content.sh show"
echo "│  Memory:       ./scripts/memory.sh index"
echo "│  Team:         ./scripts/team.sh show"
echo "│  Trading Bot:  cd /opt/slimy/pm_updown_bot_bundle && python3 runner.py --mode=shadow"
echo "│  Heartbeat:     ./scripts/heartbeat.sh"
echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

# Recent Activity
echo "┌──────────────────────────────────────────────────────────────────────┐"
echo "│  📈 RECENT ACTIVITY"
echo "├──────────────────────────────────────────────────────────────────────┤"

last_bot=$(tail -5 /home/slimy/ned-clawd/logs/trading-bot-20260218.log 2>/dev/null | grep -oP "Phase \d.*" | tail -1 || echo "No recent runs")
echo "│  Last bot run:  $last_bot"

echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""

echo "═══════════════════════════════════════════════════════════════════════"
echo "  Type a command or ask Ned for anything else"
echo "═══════════════════════════════════════════════════════════════════════"
