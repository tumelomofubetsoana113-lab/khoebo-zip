// A section's small orange eyebrow, heading and lead. With `side`, the lead
// sits to the right of the heading on wide screens, as in "How it works".
export function SectionHeading({
  eyebrow,
  heading,
  lead,
  side = false,
}: {
  eyebrow?: string;
  heading: string;
  lead?: string;
  side?: boolean;
}) {
  return (
    <div className={side ? "flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10" : ""}>
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-brand">{eyebrow}</p>}
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{heading}</h2>
      </div>
      {lead && <p className={`text-lg text-muted ${side ? "max-w-md" : "mt-3 max-w-3xl"}`}>{lead}</p>}
    </div>
  );
}
