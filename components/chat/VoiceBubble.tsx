import { Play } from "lucide-react";

// A fixed waveform shape: voice notes are simulated in this demo.
const BARS = [6, 12, 18, 10, 22, 14, 8, 16, 20, 12, 6, 14, 18, 10, 6, 12, 16, 8];

export function Waveform() {
  return (
    <svg width={BARS.length * 5} height="24" viewBox={`0 0 ${BARS.length * 5} 24`} aria-hidden="true">
      {BARS.map((h, i) => (
        <rect key={i} x={i * 5} y={(24 - h) / 2} width="3" height={h} rx="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

export function VoiceBubbleContent({ duration }: { duration: string }) {
  return (
    <span className="flex items-center gap-2">
      <Play size={18} aria-hidden="true" className="shrink-0 fill-current" />
      <Waveform />
      <span className="text-sm">{duration}</span>
    </span>
  );
}
