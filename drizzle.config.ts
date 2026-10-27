import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the host */
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
