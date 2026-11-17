"use client";

import { QrCode } from "lucide-react";
import { create } from "qrcode";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { fieldVisitPath, type Lead } from "@/lib/leads";
import { strings } from "@/lib/strings";

const t = strings.officer.leads.fieldVisit;

// The QR code as one SVG path, drawn in the theme's ink colour on a white
// surface, so no colour is typed in here.
function QrSvg({ text, label }: { text: string; label: string }) {
  const { size, d } = useMemo(() => {
    const { modules } = create(text, { errorCorrectionLevel: "M" });
    let path = "";
    for (let r = 0; r < modules.size; r++) {
      for (let c = 0; c < modules.size; c++) {
        if (modules.get(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
      }
    }
    return { size: modules.size + 4, d: path };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="mx-auto size-56 bg-surface">
      <path d={d} className="fill-ink" shapeRendering="crispEdges" />
    </svg>
  );
}

// On a lead marked for a field visit: the officer shows this QR code, the
// trader scans it, and Khoebo starts with their district and business filled in.
export function FieldVisitButton({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUrl(`${window.location.origin}${fieldVisitPath(lead)}`);
          setOpen(true);
        }}
        className="mt-3 inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-flag-blue px-4 text-sm font-semibold text-flag-blue hover:bg-page"
      >
        <QrCode size={18} aria-hidden />
        {t.button}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.title}>
        <p className="text-sm">{t.intro}</p>
        {url && <QrSvg text={url} label={t.qrLabel(lead.kind, lead.district)} />}
        <p className="mt-2 text-sm font-semibold">{t.linkLabel}</p>
        <a href={url} className="block break-all text-sm text-flag-blue underline">
          {url}
        </a>
        <p className="mt-3 text-sm text-muted">{t.note}</p>
      </Sheet>
    </>
  );
}
