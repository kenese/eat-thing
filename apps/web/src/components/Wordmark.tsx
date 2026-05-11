import './Wordmark.css';

interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'on-ink' | 'on-paper';
}

export function Wordmark({ size = 'md', tone = 'on-ink' }: WordmarkProps) {
  return (
    <span className={`wordmark wordmark--${size} wordmark--${tone}`} aria-label="Eat thing">
      Eat
      <span className="wordmark-italic">thing</span>
    </span>
  );
}
