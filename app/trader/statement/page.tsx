import type { Metadata } from "next";
import { StatementShell } from "@/components/statement/StatementView";

export const metadata: Metadata = {
  title: "Statement",
};

export default function StatementPage() {
  return <StatementShell />;
}
