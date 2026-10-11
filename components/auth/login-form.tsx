"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";
import { cn, safeNext } from "@/lib/utils";

/** `setupMessage` is set by the server when sign-in isn't configured yet; the form is then disabled. */
export function LoginForm({ setupMessage, className, ...props }: React.ComponentProps<"div"> & { setupMessage?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { body: { username, password } });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, "Couldn't sign in"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="size-4" />
        </span>
        Lister
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your details to list manifests on Square</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input id="username" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field data-invalid={!!error || undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={!!error || undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>
              <Field>
                <Button type="submit" className="h-10" disabled={busy || !!setupMessage}>
                  {busy && <Loader2 className="animate-spin" />}
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                {setupMessage && <FieldDescription className="text-center text-warning">{setupMessage}</FieldDescription>}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
