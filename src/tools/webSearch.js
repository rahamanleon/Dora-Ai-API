const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function cleanLink(href) {
  if (!href) return null;
  try {
    // DuckDuckGo wraps links in a redirect — extract the real URL
    const url = new URL(href, 'https://html.duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

async function fetchDDG(query, maxResults = 5) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
  const results = [];

  $('.result').each((i, el) => {
    if (results.length >= maxResults) return false;

    const title   = $(el).find('.result__title a').text().trim();
    const snippet = $(el).find('.result__snippet').text().trim();
    const rawHref = $(el).find('.result__title a').attr('href');
    const link    = cleanLink(rawHref);

    // Skip ads and empty results
    const isAd = $(el).hasClass('result--ad');
    if (!title || isAd) return;

    results.push({ title, snippet: snippet || null, link });
  });

  return results;
}

/**
 * Search the web via DuckDuckGo HTML.
 * @param {string} query        - Search query
 * @param {object} [options]
 * @param {number} [options.maxResults=5]  - Max results to return (1–10)
 * @param {number} [options.retries=2]     - Retry attempts on failure
 * @returns {Promise<{success: boolean, results?: Array, error?: string, query: string}>}
 */
async function webSearch(query, { maxResults = 5, retries = 2 } = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: false, error: 'Query must be a non-empty string', query };
  }

  query = query.trim();
  maxResults = Math.min(Math.max(1, maxResults), 10);

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s
        await new Promise(r => setTimeout(r, 1000 * attempt));
        console.warn(`[webSearch] Retry ${attempt}/${retries} for: "${query}"`);
      }

      const results = await fetchDDG(query, maxResults);

      if (results.length === 0) {
        return { success: true, results: [], query, note: 'No results found' };
      }

      return { success: true, results, query };

    } catch (err) {
      lastError = err;

      // Don't retry on client-side errors (4xx)
      if (err.response?.status >= 400 && err.response?.status < 500) break;
    }
  }

  console.error(`[webSearch] Failed after ${retries + 1} attempts:`, lastError.message);
  return {
    success: false,
    error: lastError.message,
    query,
  };
}

module.exports = webSearch;
