import './AgentStatusCard.css';

export type AgentState = 'idle' | 'running' | 'failed';

interface AgentStatusCardProps {
  state: AgentState;
  message: string;
}

export function AgentStatusCard({ state, message }: AgentStatusCardProps) {
  return (
    <div className={`agent-card agent-card--${state}`}>
      <div className="agent-card-eyebrow">
        <span className="agent-card-dot" aria-hidden />
        PLAYWRIGHT AGENT · {state.toUpperCase()}
      </div>
      <div className="agent-card-message">{message}</div>
    </div>
  );
}
