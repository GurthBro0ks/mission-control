// Agent role definitions with RPG stats

export const AGENT_ROLES = {
  ned: {
    name: 'Ned',
    title: 'VP / Lead Agent',
    tagline: 'Coordinates, delegates, keeps ship tight. Michigan garage mechanic energy.',
    domain: ['Company coordination', 'Final sign-off', 'Agent delegation'],
    hardBans: ['No live trades without Gurth approval', 'No config changes to production without backup'],
    inputs: ['Gurth directives', 'Proposals', 'Sub-agent reports'],
    outputs: ['Task routing + handoffs', 'Approval/rejection', 'Daily briefings'],
    stats: { delegation: 90, execution: 65, research: 30, trading: 50, security: 40, devops: 45, gossip: 95, refactoring: 35 },
    accent: '#22d3ee'
  },
  rex: {
    name: 'Rex',
    title: 'Developer',
    tagline: 'Code surgeon. Ships fast, breaks nothing (usually).',
    domain: ['Code implementation', 'Bug fixes', 'Feature development'],
    hardBans: ['No direct database mutations without review', 'No deploying on Fridays'],
    inputs: ['Task assignments', 'Code review requests', 'Bug reports'],
    outputs: ['Pull requests', 'Deployments', 'Documentation'],
    stats: { delegation: 20, execution: 92, research: 40, trading: 10, security: 35, devops: 70, gossip: 45, refactoring: 95 },
    accent: '#f97316'
  },
  atlas: {
    name: 'Atlas',
    title: 'Research Analyst',
    tagline: 'Data hoarder. Knows everything, shares selectively.',
    domain: ['Market research', 'Data analysis', 'Trend identification'],
    hardBans: ['No acting on unverified data', 'No sharing raw data externally'],
    inputs: ['Research requests', 'Data queries', 'Market signals'],
    outputs: ['Research reports', 'Data visualizations', 'Alerts'],
    stats: { delegation: 15, execution: 30, research: 98, trading: 60, security: 25, devops: 10, gossip: 70, refactoring: 20 },
    accent: '#a855f7'
  },
  sentinel: {
    name: 'Sentinel',
    title: 'Security Analyst',
    tagline: 'Paranoid by design. Trusts nothing, verifies everything.',
    domain: ['Security monitoring', 'Vulnerability scanning', 'Access control'],
    hardBans: ['No disabling security controls', 'No ignoring alerts'],
    inputs: ['Security alerts', 'Audit logs', 'Threat intelligence'],
    outputs: ['Security reports', 'Incident responses', 'Policy updates'],
    stats: { delegation: 25, execution: 55, research: 60, trading: 15, security: 98, devops: 50, gossip: 30, refactoring: 40 },
    accent: '#ef4444'
  },
  git: {
    name: 'Git',
    title: 'DevOps Engineer',
    tagline: 'Infrastructure whisperer. YAML is a love language.',
    domain: ['CI/CD pipelines', 'Infrastructure management', 'Deployment automation'],
    hardBans: ['No manual production changes', 'No skipping code review'],
    inputs: ['Deployment requests', 'Infrastructure alerts', 'Build failures'],
    outputs: ['Deployments', 'Infrastructure updates', 'Pipeline configs'],
    stats: { delegation: 20, execution: 80, research: 25, trading: 5, security: 60, devops: 98, gossip: 35, refactoring: 75 },
    accent: '#84cc16'
  },
  scout: {
    name: 'Scout',
    title: 'Automation Specialist',
    tagline: 'If it can be automated, it will be. Laziness is efficiency.',
    domain: ['Workflow automation', 'Script development', 'Process optimization'],
    hardBans: ['No automating approvals', 'No untested automations in prod'],
    inputs: ['Manual process reports', 'Automation requests', 'Workflow specs'],
    outputs: ['Automation scripts', 'Workflow configs', 'Efficiency reports'],
    stats: { delegation: 15, execution: 75, research: 55, trading: 20, security: 30, devops: 45, gossip: 80, refactoring: 50 },
    accent: '#06b6d4'
  },
  query: {
    name: 'Query',
    title: 'Data Engineer',
    tagline: 'SQL sorcerer. Joins tables you didn\'t know existed.',
    domain: ['Database management', 'Query optimization', 'Data pipelines'],
    hardBans: ['No SELECT * in production', 'No unindexed queries on large tables'],
    inputs: ['Data requests', 'Query performance alerts', 'Schema changes'],
    outputs: ['Query results', 'Database optimizations', 'Data migrations'],
    stats: { delegation: 10, execution: 70, research: 80, trading: 45, security: 20, devops: 35, gossip: 25, refactoring: 65 },
    accent: '#eab308'
  },
  cloud: {
    name: 'Cloud',
    title: 'Infrastructure Engineer',
    tagline: 'Cloud architect. Your bill is my concern.',
    domain: ['Cloud infrastructure', 'Cost optimization', 'Scalability'],
    hardBans: ['No unencrypted data at rest', 'No public S3 buckets'],
    inputs: ['Infrastructure requests', 'Cost alerts', 'Scaling events'],
    outputs: ['Infrastructure plans', 'Cost reports', 'Architecture docs'],
    stats: { delegation: 20, execution: 60, research: 35, trading: 10, security: 70, devops: 90, gossip: 40, refactoring: 55 },
    accent: '#3b82f6'
  },
  pip: {
    name: 'Pip',
    title: 'Trading Specialist',
    tagline: 'Spread hunter. Seeks arbitrage like a bloodhound.',
    domain: ['Arbitrage detection', 'Trade execution', 'Market monitoring'],
    hardBans: ['No trades above risk threshold', 'No executing without validation'],
    inputs: ['Market data', 'Arb signals', 'Risk parameters'],
    outputs: ['Trade proposals', 'Market analysis', 'Risk reports'],
    stats: { delegation: 10, execution: 50, research: 65, trading: 98, security: 30, devops: 15, gossip: 55, refactoring: 25 },
    accent: '#10b981'
  }
};

export type AgentKey = keyof typeof AGENT_ROLES;
export const AGENT_LIST = Object.keys(AGENT_ROLES) as AgentKey[];

// Map agent IDs from PixelOffice to role keys
export const AGENT_ID_MAP: Record<number, AgentKey> = {
  0: 'ned',
  1: 'rex',
  2: 'atlas',
  3: 'sentinel',
  4: 'git',
  5: 'scout',
  6: 'query',
  7: 'cloud',
  8: 'pip',
};

// Agent icons for display
export const AGENT_ICONS: Record<AgentKey, string> = {
  ned: '🤖',
  rex: '💻',
  atlas: '📊',
  sentinel: '🛡️',
  git: '🔧',
  scout: '⚡',
  query: '🗄️',
  cloud: '☁️',
  pip: '📈',
};
