"use client";
import { useActionState } from "react";
import { subscribeEmail, type SignupState } from "@/app/actions/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailSignup() {
  const [state, action, pending] = useActionState<SignupState, FormData>(subscribeEmail, { status: "idle", message: "" });
  return (
    <section aria-labelledby="signup-heading" className="mt-20 bg-muted py-14">
      <div className="site-container text-center">
        <h2 id="signup-heading" className="text-2xl md:text-3xl">
          Be the first to know
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          New arrivals, store events and the occasional note from our stylists.
        </p>
        {state.status === "ok" ? (
          <p role="status" data-testid="signup-thanks" className="mx-auto mt-6 max-w-xl font-medium text-success">
            {state.message}
          </p>
        ) : (
          <form action={action} noValidate className="mx-auto mt-6 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1 text-left">
              <label htmlFor="signup-email" className="visually-hidden">
                Email address
              </label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Your email address"
                aria-invalid={state.status === "error"}
                aria-describedby={state.status === "error" ? "signup-error" : undefined}
                required
              />
              {state.status === "error" && (
                <p id="signup-error" role="alert" className="mt-1 text-sm text-destructive">
                  {state.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Signing up…" : "Sign up"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
