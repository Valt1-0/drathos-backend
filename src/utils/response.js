export const ok = (res, data = {}, status = 200) =>
  res.status(status).json({ error: false, ...data });

export const fail = (res, message, status = 400, extra = {}) =>
  res.status(status).json({ error: true, message, ...extra });
