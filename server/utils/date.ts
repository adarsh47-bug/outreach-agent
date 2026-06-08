export function getISTDate(date: Date = new Date()): Date {
  // Return a Date object that is shifted by +5:30 so its UTC methods
  // will correctly reflect the local IST time.
  // Warning: This Date object's internal milliseconds will be shifted
  // and does not represent the absolute point in time. It is used
  // purely for extracting local hours/minutes in other functions.
  const time = date.getTime();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(time + istOffset);
}

export function getISTDateString(date: Date = new Date()): string {
  // Format the absolute point in time to an IST ISO-like string: YYYY-MM-DDTHH:mm:ss.sss+05:30
  // To get the IST components, we use the shifted date's UTC methods
  const istDate = getISTDate(date);
  
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

export function addDays(date: Date, days: number): Date {
  // Add exactly 24 hours per day to avoid DST jump issues
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function setISTTime(date: Date, hours: number, minutes: number): void {
  // Sets the absolute time of this date such that its IST time matches the given hours and minutes.
  const istDate = getISTDate(date);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  // Create absolute time corresponding to this IST time
  const utcEquivalent = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
  const absoluteTime = utcEquivalent.getTime() - (5.5 * 60 * 60 * 1000);
  date.setTime(absoluteTime);
}

export function nowMs(): number {
  return new Date().getTime();
}
