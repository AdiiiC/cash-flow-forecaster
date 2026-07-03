/* The three-state discipline, made reusable. Every data surface must be able
   to render loading, empty, and error explicitly — never a blank flash. */

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <h2>{label}</h2>
      <p>Running walk-forward backtest and calibrating intervals.</p>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="state">
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state error" role="alert">
      <h2>Could not build forecast</h2>
      <p className="num">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="primary">
          Retry
        </button>
      )}
    </div>
  );
}
