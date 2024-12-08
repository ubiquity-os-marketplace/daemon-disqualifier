export function formatMillisecondsToDaysAndHours(milliseconds: number): string {
  if (milliseconds <= 0) {
    return "0 days and 0 hours";
  }
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  } else if (hours === 0) {
    return `${days} ${days === 1 ? "day" : "days"}`;
  } else {
    return `${days} ${days === 1 ? "day" : "days"} and ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
}
