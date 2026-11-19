"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { strings } from "@/lib/strings";
import { useNextPath } from "./useNextPath";
import { Field, FormError } from "./Field";

const t = strings.auth;

export function LoginForm() {
  const next = useNextPath();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field
        label={t.fields.username}
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={30}
        defaultValue={state.values?.username}
      />
      <Field label={t.fields.password} name="password" type="password" autoComplete="current-password" required maxLength={128} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.login.working : t.login.submit}
      </Button>
      <p className="text-center text-sm text-muted">
        {t.login.noAccount}{" "}
        <Link href={signupHref} className="font-semibold text-brand hover:underline">
          {t.login.signupLink}
        </Link>
      </p>
    </form>
  );
}
