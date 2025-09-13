import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// --- Configuration ---
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const anonKey = process.env.SUPABASE_ANON_KEY;
const rapidApiKey = process.env.RAPIDAPI_KEY;
const RAPID_ENDPOINT = "https://ai-text-to-image-generator-flux-free-api.p.rapidapi.com/aaaaaaaaaaaaaaaaaiimagegenerator/quick.php";
const DEFAULT_STYLE_ID = 4;
const DEFAULT_SIZE = "1-1";

// --- Small helpers ---
const isHttp = v => typeof v === 'string' && /^https?:\/\//i.test(v);
const isDataUri = v => typeof v === 'string' && /^data:image\/(png|jpe?g|jpg|webp|gif);base64,/i.test(v);

function pickImage(json) {
  // Common direct keys
  const direct = json.image || json.image_url || json.imageUrl || json.url || json.result || json.output;
  if (isDataUri(direct) || (isHttp(direct) && /(\.png|\.jpe?g|\.webp|\.gif)(\?|#|$)/i.test(direct))) return direct;

  // Arrays (e.g. output: ["data:image..."] or images: [{url:...}])
  const arrayKeys = ['images','output','results'];
  for (const k of arrayKeys) {
    const arr = json[k];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (isDataUri(item) || isHttp(item)) return item;
        if (item && typeof item === 'object') {
          const nested = item.url || item.image || item.src;
          if (isDataUri(nested) || isHttp(nested)) return nested;
        }
      }
    }
  }

  // Deep scan fallback (shallow-ish breadth)
  const queue = [json];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    for (const v of Object.values(node)) {
      if (isDataUri(v) || isHttp(v)) return v;
      if (v && typeof v === 'object') queue.push(v);
      if (Array.isArray(v)) v.forEach(x => { if (x && typeof x === 'object') queue.push(x); });
    }
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!supabaseUrl || !serviceRole || !anonKey) return res.status(500).json({ error: 'Supabase env vars missing' });
    if (!rapidApiKey) return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/,'');
    if (!token) return res.status(401).json({ error: 'No auth token' });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' });

    const body = typeof req.body === 'object' && req.body ? req.body : {};
    let { prompt } = body;
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt required' });
    prompt = prompt.trim().slice(0,300);
    if (!prompt) return res.status(400).json({ error: 'Prompt empty' });

    const aiResp = await fetch(RAPID_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'ai-text-to-image-generator-flux-free-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt, style_id: DEFAULT_STYLE_ID, size: DEFAULT_SIZE })
    });
    const raw = await aiResp.text();
    if (!aiResp.ok) return res.status(502).json({ error: 'Upstream failure', status: aiResp.status, body: raw.slice(0,300) });
    let json; try { json = JSON.parse(raw); } catch { return res.status(502).json({ error: 'Invalid JSON from provider', raw: raw.slice(0,200) }); }

    const imageData = pickImage(json);
    if (!imageData) return res.status(502).json({ error: 'No image found in provider response' });

    const admin = createClient(supabaseUrl, serviceRole);
    let publicUrl;
    if (isDataUri(imageData)) {
      const match = imageData.match(/^data:image\/(png|jpe?g|jpg|webp|gif);base64,(.+)$/i);
      if (!match) return res.status(415).json({ error: 'Unsupported data URI' });
      const ext = match[1] === 'jpg' ? 'jpeg' : match[1].toLowerCase();
      const buffer = Buffer.from(match[2], 'base64');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0,12);
      const path = `${user.id}/${Date.now()}-${hash}.${ext}`;
      const { error: upErr } = await admin.storage.from('images').upload(path, buffer, { contentType: `image/${ext}`, upsert: false });
      if (upErr) return res.status(500).json({ error: 'Upload failed', details: upErr.message });
      publicUrl = admin.storage.from('images').getPublicUrl(path).data.publicUrl;
    } else if (isHttp(imageData)) {
      const remote = await fetch(imageData);
      if (!remote.ok) return res.status(502).json({ error: 'Fetch remote failed', status: remote.status });
      const contentType = remote.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await remote.arrayBuffer());
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0,12);
      const ext = contentType.includes('jpeg') ? 'jpeg' : contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'png';
      const path = `${user.id}/${Date.now()}-${hash}.${ext}`;
      const { error: upErr } = await admin.storage.from('images').upload(path, buf, { contentType, upsert: false });
      if (upErr) return res.status(500).json({ error: 'Upload failed', details: upErr.message });
      publicUrl = admin.storage.from('images').getPublicUrl(path).data.publicUrl;
    } else {
      return res.status(415).json({ error: 'Unrecognized image format' });
    }

    if (!publicUrl) return res.status(500).json({ error: 'Failed to obtain public URL' });
    const { error: insertErr } = await admin.from('images').insert({ user_id: user.id, prompt, image_url: publicUrl });
    if (insertErr) return res.status(500).json({ error: 'DB insert failed', details: insertErr.message });

    return res.status(200).json({ imageUrl: publicUrl });
  } catch (e) {
    console.error('generate error', e);
    return res.status(500).json({ error: 'Generation error', details: e.message });
  }
}