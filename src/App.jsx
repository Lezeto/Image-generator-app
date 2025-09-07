import { useState } from "react";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateImage = async () => {
  setLoading(true);
  setError(null);
  setImageUrl(null);

  try {
    const response = await fetch("/api/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const result = await response.json();

    // Extract first image from nested results
    const url =
      result?.result?.data?.results?.[0]?.origin ||
      result?.result?.data?.results?.[0]?.thumb;

    if (url) setImageUrl(url);
    else setError("AI API returned no image. Check prompt or API limits.");

  } catch (err) {
    console.error(err);
    setError("Error generating image.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="container">
      <h1>AI Image Generator</h1>
      <div className="input-group">
        <input
          type="text"
          placeholder="Enter a prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button onClick={generateImage} disabled={loading || !prompt}>
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {imageUrl && (
        <div className="image-wrapper">
          <img src={imageUrl} alt="AI Generated" />
        </div>
      )}
    </div>
  );
}

export default App;
