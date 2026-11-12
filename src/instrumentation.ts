/** Runs once when the server starts: bad email settings stop the boot with a clear message. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./lib/server/env")
}
