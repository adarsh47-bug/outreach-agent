export function getISTDate(date: Date = new Date()): Date {
  const time = date.getTime();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(time + istOffset);
}

export function getISTDateString(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return new Date().toISOString(); // Fallback if invalid
  }

  const istDate = getISTDate(d);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');
  
  const year = istDate.getUTCFullYear();
  const month = pad(istDate.getUTCMonth() + 1);
  const day = pad(istDate.getUTCDate());
  const hours = pad(istDate.getUTCHours());
  const minutes = pad(istDate.getUTCMinutes());
  const seconds = pad(istDate.getUTCSeconds());
  const ms = pad3(istDate.getUTCMilliseconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+05:30`;
}

export function todayISTDateString(): string {
  return getISTDateString().split('T')[0];
}

export function nowMs(): number {
  return new Date().getTime();
}

export function formatISTDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";
  const istDate = getISTDate(d);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = istDate.getUTCFullYear();
  const month = pad(istDate.getUTCMonth() + 1);
  const day = pad(istDate.getUTCDate());
  return `${year}-${month}-${day}`;
}

export function formatISTTime(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Time";
  const istDate = getISTDate(d);
  const hours = istDate.getUTCHours().toString().padStart(2, '0');
  const minutes = istDate.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
