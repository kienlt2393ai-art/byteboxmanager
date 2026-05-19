import crypto from "crypto";

function getTimestamp() {
  const now = new Date();
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return (
    utc7.getUTCFullYear() +
    p(utc7.getUTCMonth() + 1) +
    p(utc7.getUTCDate()) +
    p(utc7.getUTCHours()) +
    p(utc7.getUTCMinutes()) +
    p(utc7.getUTCSeconds()) +
    p(utc7.getUTCMilliseconds(), 3)
  );
}

function generateSignature(timestamp, body, secretToken) {
  return crypto
    .createHmac("sha512", secretToken)
    .update(`${timestamp}:${body}`, "utf8")
    .digest("hex");
}

function toTingeeTime(date) {
  const utc7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    utc7.getUTCFullYear() +
    p(utc7.getUTCMonth() + 1) +
    p(utc7.getUTCDate()) +
    p(utc7.getUTCHours()) +
    p(utc7.getUTCMinutes()) +
    p(utc7.getUTCSeconds())
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const clientId    = process.env.TINGEE_CLIENT_ID;
  const secretToken = process.env.TINGEE_SECRET_TOKEN;
  if (!clientId || !secretToken) {
    return res.status(500).json({ error: "Tingee chưa được cấu hình" });
  }

  const { shiftType, date } = req.body || {};

  const now = new Date();
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStr = vnNow.toISOString().split("T")[0];

  let startHour, endHour;
  if (shiftType === "Chiều tối") {
    startHour = 15; endHour = 23;
  } else {
    startHour = 8; endHour = 15;
  }

  const startDate = new Date(`${todayStr}T${String(startHour).padStart(2,"0")}:00:00+07:00`);
  const endDate   = new Date(`${todayStr}T${String(endHour).padStart(2,"0")}:00:00+07:00`);

  const requestBody = JSON.stringify({
    skipCount: 0,
    maxResultCount: 100,
    startTime: toTingeeTime(startDate),
    endTime:   toTingeeTime(endDate),
  });

  const timestamp = getTimestamp();
  const signature = generateSignature(timestamp, requestBody, secretToken);

  try {
    const response = await fetch(
      "https://open-api.tingee.vn/v1/transaction/get-paging",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-request-timestamp": timestamp,
          "x-signature": signature,
        },
        body: requestBody,
      }
    );

    const data = await response.json();

    if (data.code !== "00") {
      return res.status(200).json({
        total: 0, count: 0, transactions: [],
        _debug: { error: data.message, code: data.code, rawData: data }
      });
    }

    const allItems = data.data?.items || [];
    const credits  = allItems.filter(t => t.type === "CREDIT");
    const total    = credits.reduce((s, t) => s + (t.amount || 0), 0);

    return res.status(200).json({
      total,
      count: credits.length,
      transactions: credits.map(t => ({
        id:          t.transactionId,
        amount:      t.amount,
        time:        t.transactionTime,
        description: t.description,
        bank:        t.bankName,
      })),
      _debug: {
        allCount: allItems.length,
        types: [...new Set(allItems.map(t => t.type))],
        startTime: toTingeeTime(startDate),
        endTime:   toTingeeTime(endDate),
        code: data.code,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
