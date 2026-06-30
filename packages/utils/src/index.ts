export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(
    typeof date === 'string' ? new Date(date) : date
  );
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}
