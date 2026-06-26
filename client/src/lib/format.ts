export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: "Europe/Helsinki"
  }).format(new Date(value));
}

export function playerInitials(name: string) {
  const initials = name
    .split(/\s|_/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "UB";
}

export function titleizeRecordKey(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
