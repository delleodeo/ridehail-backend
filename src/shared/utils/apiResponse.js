export function sendSuccess(res, data, { statusCode = 200, meta } = {}) {
  return res.status(statusCode).json({ success: true, data, ...(meta ? { meta } : {}) });
}

