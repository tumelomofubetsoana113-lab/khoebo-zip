import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { safeNext } from "@/lib/accounts";
import { currentAccount } from "@/lib/server/session";
import { strings } from "@/lib/strings";

const t = strings.auth.signup;

export const metadata: Metadata = { title: t.metaTitle };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell title={t.title} intro={t.intro}>
      <SignupForm />
      <Suspense fallback={null}>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

// Someone already signed in goes straight to their page.
async function RedirectIfSignedIn({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const next = (await searchParams).next;
  const account = await currentAccount();
  if (account) redirect(safeNext(next, account.role));
  return null;
}
