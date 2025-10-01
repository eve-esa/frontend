import dayjs from "dayjs";

export const formatDate = (
  dateString: string,
  format: string = "D MMMM YYYY"
) => {
  return dayjs(dateString).format(format);
};
