import fs from 'fs';
import path from 'path';

const DATA_DIR = '/home/slimy/ned-clawd';

// Types
export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  delegated_to: string | null;
  progress: number;
  notes: string[];
}

export interface TaskBoard {
  board_name: string;
  created: string;
  last_updated: string;
  tasks: Task[];
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  schedule: string;
  frequency: string;
  next_run: string;
  enabled: boolean;
  type: string;
  last_run?: string;
  status: string;
  fired?: boolean;
}

export interface Calendar {
  calendar_name: string;
  created: string;
  last_updated: string;
  events: CalendarEvent[];
}

export interface Stage {
  id: string;
  name: string;
  description: string;
}

export interface PipelineItem {
  id: number;
  title: string;
  stage: string;
  created_at: string;
}

export interface Pipeline {
  pipeline_name: string;
  created: string;
  last_updated: string;
  stages: Stage[];
  items: PipelineItem[];
}

export interface SubAgent {
  id: number;
  name: string;
  role: string;
  description: string;
  trigger: string;
  status: string;
  location: string;
  used_for: string[];
  currentTask?: string;
}

export interface Lead {
  name: string;
  role: string;
  description: string;
  status: string;
  location: string;
  currentTask?: string;
}

export interface Team {
  team_name: string;
  created: string;
  last_updated: string;
  lead: Lead;
  subagents: SubAgent[];
}

// FileStore class
export class FileStore {
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private atomicWrite(filePath: string, data: string): void {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, data, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }

  // Tasks
  readTasks(): TaskBoard {
    const filePath = path.join(DATA_DIR, 'tasks/taskboard.json');
    if (!fs.existsSync(filePath)) {
      const defaultBoard: TaskBoard = {
        board_name: 'Ned & Gurth Task Board',
        created: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        tasks: [],
      };
      this.ensureDir(path.dirname(filePath));
      this.atomicWrite(filePath, JSON.stringify(defaultBoard, null, 2));
      return defaultBoard;
    }
    const board: TaskBoard = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    board.tasks = board.tasks.map(t => {
      const raw = t as Task & { delegated_to?: string | null; progress?: number; notes?: string[] };
      return {
        ...raw,
        delegated_to: raw.delegated_to ?? null,
        progress: raw.progress ?? (raw.status === 'done' ? 100 : 0),
        notes: raw.notes ?? [],
      };
    });
    return board;
  }

  writeTasks(board: TaskBoard): void {
    const filePath = path.join(DATA_DIR, 'tasks/taskboard.json');
    this.atomicWrite(filePath, JSON.stringify(board, null, 2));
  }

  // Calendar
  readCalendar(): Calendar {
    const filePath = path.join(DATA_DIR, 'calendar/calendar.json');
    if (!fs.existsSync(filePath)) {
      const defaultCal: Calendar = {
        calendar_name: 'Ned & Gurth Mission Control Calendar',
        created: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        events: [],
      };
      this.ensureDir(path.dirname(filePath));
      this.atomicWrite(filePath, JSON.stringify(defaultCal, null, 2));
      return defaultCal;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  writeCalendar(cal: Calendar): void {
    const filePath = path.join(DATA_DIR, 'calendar/calendar.json');
    this.atomicWrite(filePath, JSON.stringify(cal, null, 2));
  }

  // Team
  readTeam(): Team {
    const filePath = path.join(DATA_DIR, 'team/team.json');
    if (!fs.existsSync(filePath)) {
      const defaultTeam: Team = {
        team_name: 'Ned & Gurth Team',
        created: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        lead: {
          name: 'Ned',
          role: 'VP / Lead Agent',
          description: 'Proactive VP',
          status: 'active',
          location: 'office',
        },
        subagents: [],
      };
      this.ensureDir(path.dirname(filePath));
      this.atomicWrite(filePath, JSON.stringify(defaultTeam, null, 2));
      return defaultTeam;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  writeTeam(team: Team): void {
    const filePath = path.join(DATA_DIR, 'team/team.json');
    this.atomicWrite(filePath, JSON.stringify(team, null, 2));
  }

  // Pipeline
  readPipeline(): Pipeline {
    const filePath = path.join(DATA_DIR, 'content/pipeline.json');
    if (!fs.existsSync(filePath)) {
      const defaultPipeline: Pipeline = {
        pipeline_name: 'Ned & Gurth Content Pipeline',
        created: new Date().toISOString().split('T')[0],
        last_updated: new Date().toISOString(),
        stages: [
          { id: 'ideas', name: 'Ideas', description: 'Raw content ideas' },
          { id: 'outlines', name: 'Outlines', description: 'Structured outlines' },
          { id: 'scripts', name: 'Scripts', description: 'Full scripts' },
          { id: 'media', name: 'Media', description: 'Media assets' },
          { id: 'review', name: 'Review', description: 'Pending review' },
          { id: 'published', name: 'Published', description: 'Published' },
        ],
        items: [],
      };
      this.ensureDir(path.dirname(filePath));
      this.atomicWrite(filePath, JSON.stringify(defaultPipeline, null, 2));
      return defaultPipeline;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  writePipeline(pipeline: Pipeline): void {
    const filePath = path.join(DATA_DIR, 'content/pipeline.json');
    this.atomicWrite(filePath, JSON.stringify(pipeline, null, 2));
  }
}

export const fileStore = new FileStore();
