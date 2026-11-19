"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { MAX_BUSINESSES, MAX_PASSWORD } from "@/lib/accounts";
import { strings } from "@/lib/strings";
import { useNextPath } from "./useNextPath";
import { Field, FormError, inputClasses } from "./Field";

const t = strings.auth;

// Name, username and password, then how many businesses the trader has and
// one ID field for each. The form is sent from onSubmit rather than `action`,
// so React doesn't clear it when something needs fixing: a trader with three
// businesses shouldn't have to type every ID again.
export function SignupForm() {
  const next = useNextPath();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});
  const [count, setCount] = useState(1);
  const errors = state.fields ?? {};
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <FormError message={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field
        label={t.fields.fullName}
        name="fullName"
        autoComplete="name"
        required
        maxLength={60}
        defaultValue={state.values?.fullName}
        error={errors.fullName}
      />
      <Field
        label={t.fields.username}
        hint={t.fields.usernameHint}
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={30}
        defaultValue={state.values?.username}
        error={errors.username}
      />
      <Field
        label={t.fields.password}
        hint={t.fields.passwordHint}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        maxLength={MAX_PASSWORD}
        error={errors.password}
      />
      <Field
        label={t.fields.confirm}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        maxLength={MAX_PASSWORD}
        error={errors.confirm}
      />

      <fieldset className="space-y-4 rounded-2xl border border-line p-4">
        <legend className="px-1 text-lg font-semibold">{t.signup.businessesHeading}</legend>
        <p className="-mt-2 text-sm text-muted">{t.signup.businessesHint}</p>
        <div>
          <label htmlFor="businessCount" className="block font-semibold">
            {t.fields.businessCount}
          </label>
          <select
            id="businessCount"
            name="businessCount"
            value={count}
            onChange={(ev) => setCount(Number(ev.target.value))}
            className={`${inputClasses} mt-1.5`}
          >
            {Array.from({ length: MAX_BUSINESSES }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        {Array.from({ length: count }, (_, i) => (
          <Field
            key={i}
            label={t.fields.businessId(i + 1, count)}
            hint={i === 0 ? t.fields.businessIdHint : undefined}
            name={`businessId${i}`}
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={30}
            defaultValue={state.values?.businessIds?.[i]}
            error={errors[`businessIds.${i}`]}
          />
        ))}
      </fieldset>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.signup.working : t.signup.submit}
      </Button>
      <p className="text-center text-sm text-muted">
        {t.signup.haveAccount}{" "}
        <Link href={loginHref} className="font-semibold text-brand hover:underline">
          {t.signup.loginLink}
        </Link>
      </p>
    </form>
  );
}
