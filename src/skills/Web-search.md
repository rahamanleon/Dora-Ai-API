# Skill: web-search

## Description
Searches the web using DuckDuckGo HTML scraping, visits top result pages to extract real content, then synthesizes a concise final answer — never dumps raw links. Behaves like a research assistant: looks it up, reads it, then tells you the answer in plain language.

---

## Behavior

### Input
A natural language query from the user.
Examples:
- "What time is it in Bangladesh?"
- "Latest Node.js LTS version?"
- "What's the weather in Tokyo?"

### Process
1. **Search** — Query DuckDuckGo HTML for top results
2. **Fetch** — Visit the top 2–3 result URLs and extract body text
3. **Synthesize** — Summarize the answer in 1–3 sentences, plain English

### Output
A short, direct answer. No link dumps. No bullet lists of results. Just the answer.

**Example:**
> Query: "What time is it now in Bangladesh?"
> Answer: "It's currently 11:00 PM in Bangladesh (BST, UTC+6)."

---


### Entry Point
```js
const webSearch = require('./tools/webSearch');

// Returns: { success, results: [{ title, snippet, link }], query }
const result = await webSearch('current time in Bangladesh', { maxResults: 3 });
```

### Fetching Page Content
After getting results, fetch each link and strip to plain text:
```js
const { data } = await axios.get(link, { timeout: 8000 });
const $ = cheerio.load(data);
$('script, style, nav, footer, header').remove();
const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);
```

### Synthesis Prompt (send to LLM)
```
You are a research assistant. Given the following web content, answer the user's question in 1–3 sentences. Be direct and specific. No bullet points, no source links.

Question: {{query}}

Web content:
{{scrapedText}}

Answer:
```

---

## Error Handling
- If scraping fails for a URL, skip it and use the next result's snippet
- If all fetches fail, fall back to synthesizing from DDG snippets alone
- If no results at all, reply: "I couldn't find a reliable answer for that right now."

---

## Limits
- Max 3 pages fetched per query
- Max 2000 characters extracted per page
- Timeout: 8s per fetch
- Do not follow redirects more than 3 hops

---

## Notes
- DuckDuckGo HTML does not require an API key
- Rotate user agents to avoid soft blocks (see `webSearch.js`)
- Strip ads (`.result--ad`) before processing results
- This skill is stateless — no caching between calls
