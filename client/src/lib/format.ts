export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
  return value.replace(/([A-Z])/g, " $1");
}
