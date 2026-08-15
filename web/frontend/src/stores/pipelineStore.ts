import { create } from 'zustand';

export interface PipelineFinding {
  agent: string;
  headline: string;
  confidence: string;
  evidence: string;
}

interface PipelineState {
  runId: string | null;
  agents: string[];
  activeAgent: string | null;
  completedAgents: string[];
  findings: PipelineFinding[];
  charts: { agent: string; filename: string }[];
  status: 'idle' | 'running' | 'complete' | 'error';
  elapsed: number | null;
  eventSource: EventSource | null;
  start: (runId: string, agents: string[]) => void;
  reset: () => void;
}

const AGENT_LABELS: Record<string, string> = {
  'question-framing': 'Framing Question',
  'hypothesis': 'Generating Hypotheses',
  'data-explorer': 'Exploring Data',
  'descriptive-analytics': 'Analyzing Patterns',
  'overtime-trend': 'Analyzing Trends',
  'cohort-analysis': 'Analyzing Cohorts',
  'root-cause-investigator': 'Investigating Root Cause',
  'cross-verification': 'Cross-Verifying',
  'validation': 'Validating Findings',
  'opportunity-sizer': 'Sizing Opportunity',
  'story-architect': 'Designing Storyboard',
  'narrative-coherence-reviewer': 'Reviewing Narrative',
  'chart-maker': 'Creating Charts',
  'visual-design-critic': 'Reviewing Design',
  'storytelling': 'Writing Narrative',
  'deck-creator': 'Building Deck',
  'comms-drafter': 'Drafting Comms',
};

export function getAgentLabel(agent: string): string {
  return AGENT_LABELS[agent] || agent;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  runId: null,
  agents: [],
  activeAgent: null,
  completedAgents: [],
  findings: [],
  charts: [],
  status: 'idle',
  elapsed: null,
  eventSource: null,

  start: (runId, agents) => {
    const existing = get().eventSource;
    if (existing) existing.close();

    set({
      runId,
      agents,
      activeAgent: null,
      completedAgents: [],
      findings: [],
      charts: [],
      status: 'running',
      elapsed: null,
    });

    const es = new EventSource(`/api/pipeline/${runId}/events`);

    es.addEventListener('phase_start', (e) => {
      const data = JSON.parse(e.data);
      set({ activeAgent: data.agent });
    });

    es.addEventListener('phase_complete', (e) => {
      const data = JSON.parse(e.data);
      set((s) => ({
        activeAgent: null,
        completedAgents: [...s.completedAgents, data.agent],
      }));
    });

    es.addEventListener('finding', (e) => {
      const data = JSON.parse(e.data);
      set((s) => ({
        findings: [...s.findings, {
          agent: data.agent,
          headline: data.headline,
          confidence: data.confidence,
          evidence: data.evidence,
        }],
      }));
    });

    es.addEventListener('chart', (e) => {
      const data = JSON.parse(e.data);
      set((s) => ({
        charts: [...s.charts, { agent: data.agent, filename: data.filename }],
      }));
    });

    es.addEventListener('pipeline_complete', (e) => {
      const data = JSON.parse(e.data);
      set({ status: 'complete', elapsed: data.elapsed });
      es.close();
    });

    es.addEventListener('pipeline_error', () => {
      set({ status: 'error' });
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    set({ eventSource: es });
  },

  reset: () => {
    const es = get().eventSource;
    if (es) es.close();
    set({
      runId: null,
      agents: [],
      activeAgent: null,
      completedAgents: [],
      findings: [],
      charts: [],
      status: 'idle',
      elapsed: null,
      eventSource: null,
    });
  },
}));
