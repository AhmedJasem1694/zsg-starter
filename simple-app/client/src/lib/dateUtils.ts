/** Format any date value for display. Returns "Date not specified" for null/invalid values. */
export function formatContractDate(
  dateValue: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  if (!dateValue) return "Date not specified";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "Date not specified";
  return date.toLocaleDateString("en-GB", options);
}

/** Short form: "15 Jan 2024" */
export function formatDateShort(dateValue: string | Date | null | undefined): string {
  return formatContractDate(dateValue, { day: "numeric", month: "short", year: "numeric" });
}
