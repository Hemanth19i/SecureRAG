export interface Investigation {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  analyst: string;
  analystAvatar: string;
  created: string;
  lastActivity: string;
  description?: string;
  iocs?: string[];
  mitreTechniques?: string[];
}

export interface Alert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceIp: string;
  destIp: string;
  timestamp: string;
  status: 'new' | 'investigating' | 'resolved';
}

export interface IOC {
  id: string;
  value: string;
  type: 'ip' | 'hash' | 'domain' | 'url';
  reputationScore: number;
  firstSeen: string;
  lastSeen: string;
  sources: string[];
  associatedThreats: string[];
  threatFamily?: string;
  confidence?: number;
}

export interface Case {
  id: string;
  title: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'open' | 'in_progress' | 'under_review' | 'resolved' | 'closed';
  assignee: string;
  assigneeAvatar: string;
  dueDate: string;
  tags: string[];
  created: string;
}

export interface ThreatIntelEntry {
  id: string;
  name: string;
  type: string;
  confidence: number;
  date: string;
  source: string;
  description: string;
  iocs: string[];
  mitreTechniques: string[];
}

export interface Report {
  id: string;
  title: string;
  type: 'Executive' | 'Technical' | 'IOC' | 'Campaign';
  author: string;
  date: string;
  pages: number;
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  phase: string;
}

export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

export interface MetricCard {
  label: string;
  value: string;
  trend: number;
  trendDirection: 'up' | 'down' | 'neutral';
}
