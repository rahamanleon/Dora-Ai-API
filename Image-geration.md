# Skill: dalle3-image-generation

## Trigger Phrases
Activate this skill when the user asks to:
- Generate / create / make an image, picture, photo, drawing, art
- Draw something
- Visualize something
- Examples: "generate an image of...", "create a picture of...", "draw me a...", "make an image of...", "ছবি বানাও", "ছবি তৈরি করো", "একটা ছবি দাও"

---

## API Details

**Endpoint:** `POST /api/dalle3` on the base URL fetched from:
```
GET https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json
→ response.data.mahmud  (use this as the base URL)
```

**Full request:**
```
POST {baseUrl}/api/dalle3
Content-Type: application/json
responseType: arraybuffer   ← IMPORTANT: response is raw image bytes, not JSON

Body:
{
  "prompt": "<user's image description>"
}
```

**Response:**
- Raw binary image data (PNG)
- Save to a temp file, send as attachment, then delete the file

---

## Behavior

1. Extract the image prompt from the user's message (everything after the trigger word/command).
2. If no prompt is given, ask the user to describe what image they want.
3. Fetch the base API URL first from the GitHub JSON.
4. Send a "please wait" message and set a ⏳ reaction on the user's message.
5. POST to `/api/dalle3` with `responseType: "arraybuffer"`.
6. Save the returned bytes as a `.png` file in a `cache/` folder.
7. Unsend the "please wait" message.
8. Set ✅ reaction on the user's message.
9. Send the image as an attachment with a friendly caption.
10. Delete the temp file after sending.
11. On any error: set ❌ reaction, delete temp file if it exists, reply with error message.

---

## Response Messages

| Language | Key        | Text |
|----------|------------|------|
| en       | noPrompt   | `× Please provide a description to generate an image.` |
| en       | wait       | `🔄 Generating your DALL-E 3 image, please wait...` |
| en       | success    | `𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐃𝐀𝐋𝐋-𝐄 𝟑 𝐢𝐦𝐚𝐠𝐞 𝐛𝐚𝐛𝐲 <😘` |
| en       | error      | `× Image generation failed: {error}` |
| bn       | noPrompt   | `× বেবি, ছবি তৈরি করার জন্য কিছু তো লেখো` |
| bn       | wait       | `🔄 DALL-E 3 ছবি তৈরি হচ্ছে, একটু অপেক্ষা করো বেবি...` |
| bn       | success    | `𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐃𝐀𝐋𝐋-𝐄 𝟑 𝐢𝐦𝐚𝐠𝐞 𝐛𝐚𝐛𝐲 <😘` |
| bn       | error      | `× সমস্যা হয়েছে: {error}` |

---

## Code Pattern (for Dora's tool execution layer)

```js
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

async function generateDalle3Image(prompt) {
  // Step 1: get base URL
  const base    = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
  const baseUrl = base.data.mahmud;

  // Step 2: generate image
  const response = await axios.post(
    `${baseUrl}/api/dalle3`,
    { prompt },
    { responseType: "arraybuffer" }
  );

  // Step 3: save to cache
  const cacheDir  = path.join(__dirname, "cache");
  const filePath  = path.join(cacheDir, `dalle3_${Date.now()}.png`);
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
  fs.writeFileSync(filePath, Buffer.from(response.data));

  return filePath; // caller sends this as attachment, then deletes it
}
```

---

## Notes
- `responseType: "arraybuffer"` is mandatory — the endpoint returns raw bytes, not JSON.
- Always clean up the temp file after sending, even on error.
- The base URL is dynamic (fetched at runtime), do not hardcode it.
- Cooldown: 15 seconds per user (image generation is slow).
- If the prompt is in Bengali, pass it as-is — the API handles multilingual prompts.
