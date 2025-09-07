export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const body = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(JSON.parse(data)));
      req.on("error", err => reject(err));
    });

    const { prompt } = body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (!process.env.RAPIDAPI_KEY) return res.status(500).json({ error: "RAPIDAPI_KEY not set" });

    const aiResponse = await fetch(
      "https://ai-text-to-image-generator-flux-free-api.p.rapidapi.com/aaaaaaaaaaaaaaaaaiimagegenerator/quick.php",
      {
        method: "POST",
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          "x-rapidapi-host": "ai-text-to-image-generator-flux-free-api.p.rapidapi.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, style_id: 4, size: "1-1" }),
      }
    );

    const text = await aiResponse.text();
    let aiResult;
    try {
      aiResult = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "AI API returned invalid JSON", raw: text });
    }

    // Return the full AI response
    return res.status(200).json(aiResult);

  } catch (err) {
    console.error("Serverless error:", err);
    return res.status(500).json({ error: "Unexpected server error", details: err.toString() });
  }
}
