export function formatSafeDate(dateInput: string | number | null | undefined): string {
  if (!dateInput) return 'Pending...';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Pending...';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Pending...';
  }
}

export function formatSafeDateTime(dateInput: string | number | null | undefined): string {
  if (!dateInput) return 'Pending...';
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Pending...';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Pending...';
  }
}
