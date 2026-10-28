"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Sheet } from "@/components/ui/Sheet";

export function OverlayDemos() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open sheet
        </Button>
        <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
          Open confirm
        </Button>
      </div>
      {result && <p className="text-muted" aria-live="polite">{result}</p>}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Demo">
        <ul className="space-y-1">
          {["Load demo trader", "Show this week's summary", "Simulate a reminder", "Reset everything"].map(
            (item) => (
              <li key={item}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-card px-3 text-left hover:bg-page"
                  onClick={() => setSheetOpen(false)}
                >
                  {item}
                </button>
              </li>
            ),
          )}
        </ul>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        title="Reset everything?"
        body="This clears your records on this phone and starts again."
        confirmLabel="Reset"
        onConfirm={() => {
          setConfirmOpen(false);
          setResult("Confirmed.");
        }}
        onCancel={() => {
          setConfirmOpen(false);
          setResult("Cancelled.");
        }}
      />
    </div>
  );
}
