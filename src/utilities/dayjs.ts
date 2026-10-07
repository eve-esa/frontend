import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export const formatDate = (
  dateString: string,
  format: string = "D MMMM YYYY"
) => {
  return dayjs(dateString).format(format);
};

// The backend Motor client is not tz_aware, so its datetimes serialise
// without an offset although they are stored as UTC. Read an offsetless
// value as UTC (dayjs.utc keeps an explicit offset or Z as given), then show
// the browser's local day. Missing or invalid values give null, never today.
export const formatApiDate = (
  value: string | null | undefined,
  format: string = "D MMMM YYYY"
): string | null => {
  if (!value) return null;
  const date = dayjs.utc(value);
  return date.isValid() ? date.local().format(format) : null;
};
