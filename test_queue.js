import { getISTDateString, getISTDate, setISTTime, addDays } from "./server/utils/date.js";

// Mock the situation: User created campaign at June 6 4:46 PM IST
// Which in UTC is 11:16 AM UTC.
// Let's set the system time to something else, or just simulate nowMs.
const startTs = new Date("2026-06-06T11:16:50.000Z"); 
const nowMs = startTs.getTime(); // Simulate that this is "now"

console.log("Creation Time (UTC):", startTs.toISOString());
console.log("Creation Time (IST):", getISTDateString(startTs));

const sendingWindowStart = "09:00";
const sendingWindowEnd = "18:00";
const sendingDays = "weekdays";

const [startH, startM] = sendingWindowStart.split(":").map(Number);
const [endH, endM] = sendingWindowEnd.split(":").map(Number);
const windowStartMins = (startH || 9) * 60 + (startM || 0);
const windowEndMins = (endH || 18) * 60 + (endM || 0);

function nextValidDay(d) {
  while (true) {
    const istDate = getISTDate(d);
    const day = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = day === 0 || day === 6;

    if (sendingDays === "weekdays" && isWeekend) {
      d = addDays(d, 1);
    } else if (sendingDays === "weekends" && !isWeekend) {
      d = addDays(d, 1);
    } else {
      break; // It's a valid day
    }
  }
  return d;
}

let current = nextValidDay(new Date(startTs));
// Start at sendingWindowStart
setISTTime(current, startH, startM);

console.log("First candidate schedule (IST):", getISTDateString(current));

const slots = [];
let todayCount = 0;
const dailyLimit = 5;

for (let i = 0; i < 10; i++) {
  const currentIST = getISTDate(current);
  let hour = currentIST.getUTCHours();
  let minute = currentIST.getUTCMinutes();
  let totalMinutes = hour * 60 + minute;

  // If past the window end, OR the current generated time is in the past, move to next valid day
  if (totalMinutes > windowEndMins || current.getTime() < nowMs) {
    console.log("Time is past window or in the past, moving to next day...");
    current = addDays(current, 1);
    current = nextValidDay(current);
    setISTTime(current, startH, startM);
    todayCount = 0;
  }

  if (todayCount >= dailyLimit) {
    console.log("Hit daily limit, moving to next day...");
    current = addDays(current, 1);
    current = nextValidDay(current);
    setISTTime(current, startH, startM);
    todayCount = 0;
  }

  slots.push(getISTDateString(current));
  todayCount++;

  // Add random delay for next email (simulate 5 mins)
  current = new Date(current.getTime() + 5 * 60 * 1000);
}

console.log("Generated Slots:", slots);
