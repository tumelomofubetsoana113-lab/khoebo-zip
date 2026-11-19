// Cards that render inside Khoebo's bubbles. Amounts arrive as numbers from
// the tools and are only formatted here, never calculated.

import { CheckCircle2, Circle, Download, ExternalLink, FileText, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { downloadSavedStatement } from "@/components/statement/download";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { ChatAction, UiBlock } from "@/lib/blocks";
import { buttonKey } from "@/lib/chat";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/ledger";
import { statementPath } from "@/lib/statement";
import { strings } from "@/lib/strings";
import { BusinessRows } from "./BusinessRows";
import { SummaryCard } from "./SummaryCard";

const t = strings.chat.cards;

type ActionProps = {
  used: string[];
  disabled: boolean; // while a request is on its way
  onAction: (action: ChatAction, label: string) => void;
};

function CardFrame({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mt-2 min-w-56 rounded-card border border-line bg-page p-3">
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

// Which business a card is for, when the trader has more than one.
function BusinessLine({ name }: { name?: string }) {
  return name ? <p className="text-sm font-semibold text-flag-blue">{name}</p> : null;
}

// The business on a card's buttons. Left out for the first business, as before.
function forBusiness(id?: string): { businessId?: string } {
  return id && id !== "main" ? { businessId: id } : {};
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="mt-2 space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="text-muted">{row.label}</dt>
          <dd className="text-right font-semibold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PlaceholderNote({ text }: { text: string }) {
  return (
    <p className="mt-2 flex gap-1.5 text-sm text-muted">
      <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

// A card button that can be tapped once. After that it shows what happened.
function CardButton({
  action,
  label,
  doneLabel,
  variant = "primary",
  used,
  disabled,
  onAction,
}: ActionProps & { action: ChatAction; label: string; doneLabel: string; variant?: "primary" | "secondary" }) {
  if (used.includes(buttonKey(action))) {
    return (
      <span className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-green-text">
        <CheckCircle2 size={18} aria-hidden="true" className="text-flag-green" />
        {doneLabel}
      </span>
    );
  }
  return (
    <Button variant={variant} size="sm" disabled={disabled} onClick={() => onAction(action, label)}>
      {label}
    </Button>
  );
}

function EntryReceipt({ entry, ...props }: ActionProps & { entry: Extract<UiBlock, { type: "entry_receipt" }>["entry"] }) {
  return (
    <CardFrame>
      <div className="flex items-start gap-2">
        <CheckCircle2 size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-flag-green" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-green-text">{t.recorded}</p>
          <p>
            {entry.kind === "sale" ? t.sale : entry.kind === "purchase" ? t.purchase : t.clientMoney}{" "}
            {formatMoney(entry.amount)} · {formatDate(entry.date)}
          </p>
          {entry.note && <p className="text-sm text-muted">{entry.note}</p>}
          {entry.kind === "client_money" && <p className="text-sm text-muted">{t.clientMoneyHint}</p>}
          {entry.currency === "rand" && <p className="text-sm text-muted">{t.paidInRand}</p>}
          {entry.receipt?.lekuka === "verified" && <LekukaLine status="verified" />}
        </div>
      </div>
      <div className="mt-1 flex justify-end">
        <CardButton
          {...props}
          action={{ type: "undo_entry", entryId: entry.id }}
          label={t.undo}
          doneLabel={t.undone}
          variant="secondary"
        />
      </div>
    </CardFrame>
  );
}

function LekukaLine({ status }: { status: keyof typeof t.lekuka }) {
  const verified = status === "verified";
  const Icon = verified ? ShieldCheck : Info;
  return (
    <p className={`mt-2 flex gap-1.5 text-sm ${verified ? "font-semibold text-green-text" : "text-muted"}`}>
      <Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${verified ? "text-flag-green" : ""}`} />
      <span>{t.lekuka[status]}</span>
    </p>
  );
}

function ReceiptCard({ block, ...props }: ActionProps & { block: Extract<UiBlock, { type: "receipt_card" }> }) {
  const save: ChatAction = {
    type: "confirm_receipt",
    receiptId: block.receiptId,
    total: block.total,
    date: block.date,
    note: block.note,
    invoiceNumber: block.invoiceNumber,
    deviceId: block.deviceId,
    verificationCode: block.verificationCode,
    ...forBusiness(block.businessId),
  };
  const change: ChatAction = { type: "change_receipt", receiptId: block.receiptId, total: block.total, date: block.date };
  const saved = props.used.includes(buttonKey(save));
  const changing = props.used.includes(buttonKey(change));
  const choices = block.businesses?.length ? block.businesses : null;
  return (
    <CardFrame title={t.receiptTitle}>
      <BusinessLine name={block.businessName} />
      <Rows
        rows={[
          ...(block.supplier ? [{ label: t.supplier, value: block.supplier }] : []),
          { label: t.date, value: formatDate(block.date) },
          { label: t.totalPaid, value: formatMoney(block.total) },
        ]}
      />
      <LekukaLine status={block.lekuka} />
      {block.dateAssumed && <PlaceholderNote text={t.dateAssumed} />}
      {block.possibleDuplicate && <PlaceholderNote text={t.possibleDuplicate} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!changing &&
          (choices ? (
            saved ? (
              <CardButton {...props} action={save} label={t.savePurchase} doneLabel={t.saved} />
            ) : (
              choices.map((b) => (
                <CardButton
                  key={b.id}
                  {...props}
                  action={{ ...save, ...forBusiness(b.id) }}
                  label={strings.businesses.saveTo(b.name)}
                  doneLabel={strings.businesses.savedTo(b.name)}
                />
              ))
            )
          ) : (
            <CardButton {...props} action={save} label={t.savePurchase} doneLabel={t.saved} />
          ))}
        {!saved && <CardButton {...props} action={change} label={t.change} doneLabel={t.change} variant="secondary" />}
      </div>
    </CardFrame>
  );
}

function ReturnCard({ block, ...props }: ActionProps & { block: Extract<UiBlock, { type: "return_card" }> }) {
  const b = forBusiness(block.businessId);
  const confirm: ChatAction = { type: "confirm_return", period: block.period, turnover: block.turnover, ...b };
  const change: ChatAction = { type: "change_return", period: block.period, ...b };
  const confirmed = props.used.includes(buttonKey(confirm));
  return (
    <CardFrame title={t.returnTitle(block.period)}>
      <BusinessLine name={block.businessName} />
      <p className="text-sm text-muted">{t.periodDates(formatDate(block.start), formatDate(block.end))}</p>
      <Rows
        rows={[
          { label: t.turnover, value: formatMoney(block.turnover) },
          { label: t.estimatedTax, value: formatMoney(block.taxEstimate) },
          { label: t.dueDate, value: formatDate(block.dueDate) },
        ]}
      />
      {block.note && <PlaceholderNote text={block.note} />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CardButton {...props} action={confirm} label={t.confirm} doneLabel={t.confirmed} />
        {!confirmed && (
          <CardButton {...props} action={change} label={t.change} doneLabel={t.change} variant="secondary" />
        )}
      </div>
    </CardFrame>
  );
}

function PaymentCard({ block, ...props }: ActionProps & { block: Extract<UiBlock, { type: "payment_card" }> }) {
  return (
    <CardFrame title={t.paymentTitle}>
      <BusinessLine name={block.businessName} />
      <Rows
        rows={[
          { label: t.amount, value: formatMoney(block.amount) },
          { label: t.reference, value: block.reference },
        ]}
      />
      <PlaceholderNote text={t.noRealMoney} />
      {block.note && <PlaceholderNote text={block.note} />}
      <div className="mt-3">
        <CardButton
          {...props}
          action={{ type: "pay_return", period: block.period, ...forBusiness(block.businessId) }}
          label={t.pay}
          doneLabel={t.paid}
        />
      </div>
    </CardFrame>
  );
}

function ReminderCard({ block, ...props }: ActionProps & { block: Extract<UiBlock, { type: "reminder_card" }> }) {
  return (
    <CardFrame title={t.reminderTitle(block.period)}>
      <BusinessLine name={block.businessName} />
      <Rows
        rows={[
          { label: t.dueDate, value: formatDate(block.dueDate) },
          { label: t.estimatedTax, value: formatMoney(block.taxEstimate) },
        ]}
      />
      {block.note && <PlaceholderNote text={block.note} />}
      <div className="mt-3">
        <CardButton
          {...props}
          action={{ type: "file_now", period: block.period, ...forBusiness(block.businessId) }}
          label={t.fileNow}
          doneLabel={t.done}
        />
      </div>
    </CardFrame>
  );
}

function RegistrationCard({ block }: { block: Extract<UiBlock, { type: "registration_card" }> }) {
  return (
    <CardFrame title={t.registrationTitle}>
      <p className="mt-1 text-muted">{t.registrationIntro}</p>
      <ul className="mt-1 space-y-1">
        {block.checklist.map((item) => (
          <li key={item} className="flex gap-2">
            <Circle size={16} aria-hidden="true" className="mt-1 shrink-0 text-flag-blue" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-semibold">{block.handoff}</p>
      {block.links?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {block.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-flag-blue px-4 text-sm font-semibold text-surface hover:opacity-90"
            >
              {l.label}
              <ExternalLink size={16} aria-hidden="true" />
              <span className="sr-only">{t.opensNewTab}</span>
            </a>
          ))}
        </div>
      ) : null}
      {block.officerNote && <p className="mt-2 font-semibold text-green-text">{block.officerNote}</p>}
    </CardFrame>
  );
}

// What a taxpayer has to do, each with this trader's own status. The text comes
// from the tool, already worked out; this card only lays it out.
function ObligationsCard({ block }: { block: Extract<UiBlock, { type: "obligations_card" }> }) {
  return (
    <CardFrame title={t.obligationsTitle}>
      <ol className="mt-2 space-y-2">
        {block.items.map((item) => (
          <li key={item.text} className="flex gap-2">
            {item.done ? (
              <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-flag-green" />
            ) : (
              <Circle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-flag-blue" />
            )}
            <span>
              <span className="sr-only">{item.done ? t.obligationsDone : t.obligationsToDo}: </span>
              {item.text}
            </span>
          </li>
        ))}
      </ol>
      {block.note && <PlaceholderNote text={block.note} />}
    </CardFrame>
  );
}

// A statement of the trader's records. Opening it shows the printable page;
// downloading saves a spreadsheet made from the records on this phone.
function StatementCard({ block }: { block: Extract<UiBlock, { type: "statement_card" }> }) {
  const st = strings.chat.statement;
  return (
    <CardFrame title={st.cardTitle(block.title)}>
      <BusinessLine name={block.businessName} />
      <p className="text-sm text-muted">{t.periodDates(formatDate(block.start), formatDate(block.end))}</p>
      <Rows
        rows={[
          { label: strings.chat.summary.moneyIn, value: formatMoney(block.moneyIn) },
          { label: strings.chat.summary.moneyOut, value: formatMoney(block.moneyOut) },
          { label: strings.chat.summary.profit, value: formatMoney(block.profit) },
          ...(block.clientMoney ? [{ label: strings.chat.summary.clientMoney, value: formatMoney(block.clientMoney) }] : []),
        ]}
      />
      <p className="mt-2 text-sm text-muted">{strings.chat.summary.entries(block.entryCount)}</p>
      <BusinessRows rows={block.byBusiness} />
      <PlaceholderNote text={st.disclaimer} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ButtonLink href={statementPath(block.period, block.businessId)} size="sm">
          <FileText size={16} aria-hidden="true" />
          {st.open}
        </ButtonLink>
        <Button variant="secondary" size="sm" onClick={() => downloadSavedStatement(block.period, block.businessId)}>
          <Download size={16} aria-hidden="true" />
          {st.download}
        </Button>
      </div>
    </CardFrame>
  );
}

// Renders a message's UI blocks. Quick replies are drawn separately, under the list.
export function UiBlocks({ blocks, ...props }: ActionProps & { blocks: UiBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "entry_receipt":
            return <EntryReceipt key={i} entry={block.entry} {...props} />;
          case "summary_card":
            return (
              <SummaryCard
                key={i}
                period={`${block.label} · ${formatDate(block.start)} to ${formatDate(block.end)}`}
                moneyIn={formatMoney(block.moneyIn)}
                moneyOut={formatMoney(block.moneyOut)}
                clientMoney={block.clientMoney ? formatMoney(block.clientMoney) : undefined}
                profit={formatMoney(block.profit)}
                entries={block.entryCount}
                byBusiness={block.byBusiness}
              />
            );
          case "return_card":
            return <ReturnCard key={i} block={block} {...props} />;
          case "payment_card":
            return <PaymentCard key={i} block={block} {...props} />;
          case "reminder_card":
            return <ReminderCard key={i} block={block} {...props} />;
          case "obligations_card":
            return <ObligationsCard key={i} block={block} />;
          case "registration_card":
            return <RegistrationCard key={i} block={block} />;
          case "placeholder_note":
            return <PlaceholderNote key={i} text={block.text} />;
          case "receipt_card":
            return <ReceiptCard key={i} block={block} {...props} />;
          case "statement_card":
            return <StatementCard key={i} block={block} />;
          default:
            return null; // quick_replies, and anything unknown from an older save
        }
      })}
    </>
  );
}
