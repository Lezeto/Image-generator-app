import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) fetchGallery();
      else setGallery([]);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInOrUp = async () => {
    setError(null);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setError(error.message);
    }
  };

  const signOut = () => supabase.auth.signOut();

  const fetchGallery = async () => {
    setLoadingGallery(true);
    const { data, error } = await supabase.from("images").select("*").order("created_at", { ascending: false });
    if (!error) setGallery(data);
    setLoadingGallery(false);
  };

  const generateImage = async () => {
    let trimmed = (prompt || "").trim();
    if (!trimmed) {
      setError("Prompt cannot be empty");
      return;
    }
    if (trimmed.length > 300) trimmed = trimmed.slice(0, 300);

    setLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) throw new Error("Not signed in");
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${s.access_token}`
        },
        body: JSON.stringify({ prompt: trimmed })
      });
      let json;
      try {
        json = await resp.json();
      } catch {
        throw new Error("Invalid JSON from server");
      }
      if (!resp.ok) throw new Error(json.error || "Failed");
      if (!json.imageUrl || !/^https?:\/\//.test(json.imageUrl)) {
        throw new Error("Backend returned invalid imageUrl");
      }
      setImageUrl(json.imageUrl);
      await fetchGallery();
    } catch (e) {
      console.warn("generateImage error", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="container">
        <h1>AI Image Generator</h1>
        <div className="auth-box">
          <select value={authMode} onChange={e => setAuthMode(e.target.value)}>
            <option value="signin">Sign In</option>
            <option value="signup">Sign Up</option>
          </select>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input
              placeholder="Password"
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
            />
          <button onClick={signInOrUp}>{authMode === "signup" ? "Create Account" : "Sign In"}</button>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <h1 style={{ flex: 1 }}>AI Image Generator</h1>
        <button onClick={signOut}>Sign Out</button>
      </header>

      <div className="input-group">
        <input
          type="text"
          placeholder="Enter a prompt..."
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); if (error) setError(null); }}
          maxLength={350}
        />
        <button onClick={generateImage} disabled={loading || !prompt}>
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {imageUrl && (
        <div className="image-wrapper">
          <img src={imageUrl} alt="Generated" loading="lazy" onError={(e)=>{ e.currentTarget.src = "https://placehold.jp/512x512.png?text=Img+Error"; }} />
        </div>
      )}

      <h2>Your Images</h2>
      {loadingGallery && <p>Loading...</p>}
      {!loadingGallery && gallery.length === 0 && <p>No images yet.</p>}
      <div className="gallery-grid">
        {gallery.map(img => (
          <div key={img.id} className="thumb">
            <img src={img.image_url} alt={img.prompt} loading="lazy" onError={(e)=>{ e.currentTarget.src = "https://placehold.jp/160x160.png?text=Broken"; }} />
            <small>{img.prompt}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
