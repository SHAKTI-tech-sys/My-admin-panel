export const getTsMillis = (ts: any) => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (ts.toMillis) return ts.toMillis();
  if (ts.toDate) return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
  return 0;
};

export const getTsDate = (ts: any) => {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  const millis = getTsMillis(ts);
  return new Date(millis);
};
