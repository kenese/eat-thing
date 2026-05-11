import type { ReactNode } from 'react';
import './PageTitle.css';

interface PageTitleProps {
  /** Small uppercase label rendered above the title. */
  eyebrow?: string;
  /** The main page title — rendered in italic Lora, followed by a persimmon period. */
  title: string;
  /** One-liner summary line shown beneath the title. */
  summary?: ReactNode;
  /** Buttons/links shown on the right of the title row. */
  actions?: ReactNode;
}

export function PageTitle({ eyebrow, title, summary, actions }: PageTitleProps) {
  return (
    <div className="page-title-row">
      <div className="page-title-text">
        {eyebrow && <div className="page-title-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">
          {title}
          <span className="dot">.</span>
        </h1>
        {summary && <div className="page-title-summary">{summary}</div>}
      </div>
      {actions && <div className="page-title-actions">{actions}</div>}
    </div>
  );
}
