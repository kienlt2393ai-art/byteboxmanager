export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Chưa cấu hình Gemini API Key" });

  const { contents, systemPrompt } = req.body || {};

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{role:"user", parts:[{text: systemPrompt + "\n\nCâu hỏi: " + contents[0].parts[0].text}]},
            ...contents.slice(1)]
        })
      }
    );
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
