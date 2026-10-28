// The thin blue, white and green tricolour. The only use of the flag.
export function Stripe({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex h-1 w-full flex-col ${className}`}>
      <div className="flex-1 bg-flag-blue" />
      <div className="flex-1 bg-surface" />
      <div className="flex-1 bg-flag-green" />
    </div>
  );
}
