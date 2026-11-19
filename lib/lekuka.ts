// A stand-in for RSL's Lekuka invoice check. Nothing here contacts RSL: live
// taxpayer systems aren't open to Khoebo yet, so a pilot would need an
// agreement with RSL before this could call the real service.
//
// It takes only what's printed on the invoice. No trader details reach it, so
// checking a receipt can't tell RSL who holds it. Keep it that way in a pilot.

export type LekukaFields = {
  invoiceNumber?: string;
  deviceId?: string;
  verificationCode?: string;
};

export type LekukaStatus =
  | "verified" // the invoice is on record and matches the receipt
  | "mismatch" // the code is on record, but something differs from the receipt
  | "not_found" // a code was given, but it isn't on record
  | "no_code"; // the receipt has no Lekuka code

export type LekukaDifference = "invoice_number" | "device_id" | "date" | "total";

export type LekukaResult = {
  status: LekukaStatus;
  simulated: true;
  seller?: string;
  differences?: LekukaDifference[];
};

type MockInvoice = {
  invoiceNumber: string;
  deviceId: string;
  verificationCode: string;
  seller: string;
  date: string;
  total: number;
};

// Made-up invoices for the sample receipts in public/samples/receipts and
// tests/receipt-eval. Every seller is fictional and says so.
const MOCK_INVOICES: MockInvoice[] = [
  { invoiceNumber: "1042", deviceId: "470", verificationCode: "A1C4-52D8-07B9-3E61", seller: "Sample Wholesalers (Pty) Ltd", date: "2026-11-03", total: 1113 },
  { invoiceNumber: "1019", deviceId: "470", verificationCode: "E0CA-5208-D591-3E70", seller: "Sample Wholesalers (Pty) Ltd", date: "2026-10-28", total: 1427.96 },
  { invoiceNumber: "1031", deviceId: "512", verificationCode: "7B2F-90AC-14D6-C83E", seller: "Sample Traders Maseru", date: "2026-10-30", total: 2340.5 },
  { invoiceNumber: "1055", deviceId: "470", verificationCode: "3D9E-61B7-F204-8AC5", seller: "Sample Wholesalers (Pty) Ltd", date: "2026-11-02", total: 1590 },
  { invoiceNumber: "1077", deviceId: "618", verificationCode: "C47A-0E3D-92B1-65F8", seller: "Sample Distributors Lesotho", date: "2026-10-26", total: 5210 },
  { invoiceNumber: "1063", deviceId: "512", verificationCode: "19F6-D2C8-B370-4E9A", seller: "Sample Traders Maseru", date: "2026-11-02", total: 24680 },
  { invoiceNumber: "1070", deviceId: "470", verificationCode: "8E05-A7D3-6C1B-F492", seller: "Sample Wholesalers (Pty) Ltd", date: "2026-11-03", total: 702.35 },
];

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function checkLekukaInvoice(
  fields: LekukaFields,
  printed: { total: number; date: string },
): LekukaResult {
  const code = clean(fields.verificationCode);
  if (!code) return { status: "no_code", simulated: true };

  const invoice = MOCK_INVOICES.find((i) => i.verificationCode === code);
  if (!invoice) return { status: "not_found", simulated: true };

  const differences: LekukaDifference[] = [];
  if (fields.invoiceNumber && clean(fields.invoiceNumber) !== invoice.invoiceNumber) differences.push("invoice_number");
  if (fields.deviceId && clean(fields.deviceId) !== invoice.deviceId) differences.push("device_id");
  if (printed.date !== invoice.date) differences.push("date");
  if (Math.abs(printed.total - invoice.total) >= 0.01) differences.push("total");

  return differences.length
    ? { status: "mismatch", simulated: true, seller: invoice.seller, differences }
    : { status: "verified", simulated: true, seller: invoice.seller };
}
