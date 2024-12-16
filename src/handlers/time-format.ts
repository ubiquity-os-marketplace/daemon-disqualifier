export function formatMillisecondsToHumanReadable(milliseconds: number): string {
  if (milliseconds <= 0) {
    return "< 1 minute";
  }
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const components: string[] = [];

  if (days > 0) {
    components.push(`${days} ${days === 1 ? "day" : "days"}`);
  }

  if (hours > 0) {
    components.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }

  if (minutes > 0) {
    components.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }

  if (components.length === 0) {
    return "< 1 minute";
  }

  if (components.length === 1) {
    return components[0];
  } else if (components.length === 2) {
    return `${components[0]} and ${components[1]}`;
  } else {
    return `${components[0]}, ${components[1]}, and ${components[2]}`;
  }
}
