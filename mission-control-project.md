# Mission Control Project

**Created**: 2026-02-23
**Status**: Active
**Owner**: Gurth (Jason Fish)

---

## Agent Roles & Responsibilities

| Agent | Role | Responsibilities |
|-------|------|------------------|
| **Ned** | Lead Orchestrator | Coordinate agents, track missions, manage ops.db, report status |
| **Atlas** | Research Analyst | Web search, docs research, fact-finding, data analysis |
| **Sentinel** | Security Analyst | Security audits, vulnerability scans, secret detection |
| **Rex** | Engineer | Coding, debugging, refactoring, tests, implementation |
| **Query** | DB Engineer | Database ops, queries, schemas, migrations |
| **Cloud** | Infra Engineer | AWS, Azure, Kubernetes, Terraform, cloud infra |
| **Git** | VC Engineer | GitHub ops - issues, PRs, workflows, repo management |
| **Scout** | Recon Specialist | Browser automation, web scraping, navigation, data extraction |
| **Pip** | Trading Specialist | Trading bot ops, market analysis, DeFi (shadow mode only) |
| **Forge** | Tool Builder | Internal tools, scripts, utilities, automations |

---

## Mission Control Infrastructure

### Task Management
- **Taskboard**: `/home/slimy/ned-clawd/tasks/taskboard.json`
- **Directives**: `/home/slimy/ned-clawd/directives/latest.txt`

### Ops Database
- **Database**: `/home/slimy/ned-clawd/ops/ops.db`
- **Tables**: ops_missions, ops_steps, ops_proposals, ops_events, ops_triggers, ops_policy, ops_reactions

### Workflow
1. **Proposals** → Gurth creates proposals via Mission Control
2. **Ned** receives proposal webhook, creates mission in ops.db
3. **Steps** are created with assigned agents
4. **Delegation** → Spawn appropriate sub-agent with full context
5. **Tracking** → Update step status, report progress
6. **Completion** → Mark done, assemble deliverable, report to Gurth

---

## Communication Channels

| Channel | Purpose |
|---------|---------|
| **Telegram** | Primary - user interaction, status updates |
| **Discord** | Secondary - currently disabled |
| **Directives** | Async messages from Gurth |

---

## Current Active Tasks

| Task ID | Title | Status | Assignee |
|---------|-------|--------|----------|
| 1 | Fix trading bot syntax errors | done | ned |
| 2 | Run trading bot in shadow mode | in_progress | pip |
| 3 | Move bot to micro-live mode | todo | gurth |
| 4 | Fix chkrootkit cron frequency | done | ned |
| 6 | Test: Verify task bridge | todo | Rex |
| 7 | test task | in_progress | ned |
| 8 | Bug fix verification test | todo | Rex |

---

## Mission Control Status: OPERATIONAL

- Taskboard: Active
- Directives: Active
- Ops Database: Active
- Sub-agent spawning: Ready
- Heartbeat monitoring: Active

---

*Created by Ned - 2026-02-23*
