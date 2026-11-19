// Sign-up and log-in rules (added 19 Nov 2026). Pure, so the forms and the
// server share them and they can be tested. The server always checks again.

import { z } from "zod";
import { strings } from "./strings";

const e = strings.auth.errors;

export const MAX_BUSINESSES = 10;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

export type Role = "trader" | "officer";

// What the browser is told about the signed-in user. Never the password hash.
export type Account = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  businessIds: string[];
};

// Where each kind of user lands after logging in.
export function homeFor(role: Role): "/trader" | "/officer" {
  return role === "officer" ? "/officer" : "/trader";
}

// After logging in, go back to the page that asked for it (say a field-visit
// link with its details), but only to a page of this user's own side.
export function safeNext(next: unknown, role: Role): string {
  const home = homeFor(role);
  if (typeof next !== "string" || next.length > 500 || /[\\\s]/.test(next)) return home;
  return next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`) ? next : home;
}

// Names that could be mistaken for staff or the service itself.
const RESERVED = new Set(["admin", "administrator", "officer", "rsl", "khoebo", "support", "help", "root", "system"]);

// Passwords too common to allow, whatever their length.
const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyuiop",
  "11111111", "00000000", "iloveyou", "abcd1234", "qwerty123", "letmein1", "welcome1", "khoebo123",
  "lesotho1", "maseru123", "admin123", "87654321", "asdfghjk",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

// Upper case, single spaces: "ab 12/3" and "AB  12/3" are the same ID.
export function normalizeBusinessId(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

const username = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(3, e.usernameShort)
      .max(30, e.usernameLong)
      .regex(/^[a-z0-9][a-z0-9._-]*$/, e.usernameChars)
      .refine((u) => !RESERVED.has(u), e.usernameReserved),
  );

const password = z
  .string()
  .min(MIN_PASSWORD, e.passwordShort)
  .max(MAX_PASSWORD, e.passwordLong)
  .refine((p) => !COMMON.has(p.toLowerCase()), e.passwordCommon);

const businessId = z
  .string()
  .transform(normalizeBusinessId)
  .pipe(
    z
      .string()
      .min(2, e.businessIdShort)
      .max(30, e.businessIdLong)
      .regex(/^[A-Z0-9][A-Z0-9 /.-]*$/, e.businessIdChars),
  );

export const SignupSchema = z
  .object({
    fullName: z.string().trim().min(2, e.nameShort).max(60, e.nameLong),
    username,
    password,
    confirm: z.string(),
    businessIds: z.array(businessId).min(1).max(MAX_BUSINESSES),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: e.passwordsDiffer });
    if (v.password.toLowerCase().includes(v.username)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: e.passwordHasUsername });
    }
    const seen = new Set<string>();
    v.businessIds.forEach((id, i) => {
      if (seen.has(id)) ctx.addIssue({ code: "custom", path: ["businessIds", i], message: e.businessIdRepeated });
      seen.add(id);
    });
  });

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  username: z.string().transform(normalizeUsername).pipe(z.string().min(1).max(30)),
  password: z.string().min(1).max(MAX_PASSWORD),
});

export type FieldErrors = Partial<Record<string, string>>;

// The first message for each field, keyed "fullName", "businessIds.0" and so on.
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

// Reads the sign-up form. The number of businesses decides how many ID
// fields count, so stale fields left over from a bigger number are ignored.
export function readSignupForm(form: FormData) {
  const count = Math.min(MAX_BUSINESSES, Math.max(1, Number(form.get("businessCount")) || 1));
  return {
    fullName: String(form.get("fullName") ?? ""),
    username: String(form.get("username") ?? ""),
    password: String(form.get("password") ?? ""),
    confirm: String(form.get("confirm") ?? ""),
    businessIds: Array.from({ length: count }, (_, i) => String(form.get(`businessId${i}`) ?? "")),
  };
}
