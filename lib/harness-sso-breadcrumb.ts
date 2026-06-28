type BreadcrumbValue = boolean | number | string | null | undefined;

const LONG_SECRET_SHAPED_VALUE = /^[A-Za-z0-9_-]{32,}$/;
const FORBIDDEN_VALUE_KEY = /(^|_)(authorization|cookie|secret|session|token|value)$/i;

function sanitizeValue(key: string, value: BreadcrumbValue): boolean | number | string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") return value;
  if (FORBIDDEN_VALUE_KEY.test(key) || LONG_SECRET_SHAPED_VALUE.test(value)) return "[redacted]";
  return value;
}

export function logHarnessSsoBreadcrumb(event: string, fields: Record<string, BreadcrumbValue>): void {
  const safeFields: Record<string, boolean | number | string | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    safeFields[key] = sanitizeValue(key, value);
  }
  console.info("[harness-sso]", JSON.stringify({ event, ...safeFields }));
}
