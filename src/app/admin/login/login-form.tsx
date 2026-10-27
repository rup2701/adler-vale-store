"use client";
import { useActionState } from "react";
import { signInAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, { error: null, locked: false });
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state.error && (
        <p role="alert" data-testid="login-error" className="border border-destructive bg-[#fbeceb] p-3 text-sm">
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
