export default async function handler(req, res) {
  const encodedParams = new URLSearchParams();

  const url =
    "https://midjourney-best-experience.p.rapidapi.com/mj/action-relax?action=variation1&image_id=11209086137713295861&hook_url=https%3A%2F%2Fwww.google.com";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-rapidapi-key": process.env.RAPIDAPI_KEY, // env var on Vercel
        "x-rapidapi-host": "midjourney-best-experience.p.rapidapi.com",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodedParams,
    });

    const result = await response.text();
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
