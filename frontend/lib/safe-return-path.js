const protectedPaths = new Set([
  "/dashboard",
  "/vehicles",
  "/diagnostics",
  "/ai-diagnostic-agent",
  "/maintenance",
  "/service-requests",
]);

const origin = "https://fleetcare.invalid";

export function getSafeReturnPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !protectedPaths.has(url.pathname)) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
