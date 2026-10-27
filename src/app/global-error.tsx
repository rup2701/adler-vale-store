"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>The shop is having a moment</h1>
        <p>Your cart is saved in this browser. Please try again in a moment.</p>
        <button onClick={() => reset()} style={{ padding: "0.75rem 1.5rem", marginTop: "1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
