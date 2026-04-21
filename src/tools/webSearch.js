/**
 * Web Search Tool - DuckDuckGo HTML scraping via regex
 * Matches the working Python implementation in local-web-search-skill
 */
const axios = require('axios');
const config = require('../config');

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function unwrapDDG(href) {
  if (!href) return null;
  try {
    if (href.startsWith('//')) href = 'https:' + href;
    const url = new URL(href, 'https://duckduckgo.com');
    if (url.hostname.includes('duckduckgo.com') && url.pathname.startsWith('/l/')) {
      return decodeURIComponent(url.searchParams.get('uddg') || href);
    }
    return href;
  } catch {
    return href;
  }
}

function trustScore(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const high = new Set(['github.com', 'arxiv.org', 'nature.com', 'reuters.com', 'apnews.com', 'bloomberg.com']);
    const medium = new Set(['medium.com', 'dev.to', 'stackoverflow.com', 'reddit.com']);
    if (high.has(domain) || domain.endsWith('.gov') || domain.endsWith('.edu')) return { score: 0.92, tier: 'high' };
    if (medium.has(domain)) return { score: 0.58, tier: 'low' };
    return { score: 0.65, tier: 'medium' };
  } catch {
    return { score: 0.45, tier: 'unknown' };
  }
}

async function fetchWithBackoff(url, retries = 3) {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
          'Accept-Charset': 'utf-8, windows-1252',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 25000,
        maxRedirects: 5,
      });
      // Force utf-8 if detected as windows-1252 or iso
      const charsetMatch = response.headers['content-type']?.match(/charset=([^\s;]+)/i);
      if (charsetMatch && !charsetMatch[1].toLowerCase().includes('utf-8')) {
        try {
          return Buffer.from(response.data, 'binary').toString('utf-8');
        } catch { /* keep as-is */ }
      }
      return response.data;
    } catch (err) {
      if (attempt === retries) throw err;
      const waitMs = 1000 * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`[webSearch] Retry ${attempt + 1}/${retries} after ${waitMs.toFixed(0)}ms: ${err.message}`);
      await delay(waitMs);
    }
  }
}

function parseResults(html) {
  const linkRe = /<a [^>]*class="[^"]*result__a[^"]*" [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  const snippetRe = /<a [^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

  const links = [...html.matchAll(linkRe)];
  const snippets = [...html.matchAll(snippetRe)];

  const results = [];
  for (let i = 0; i < links.length; i++) {
    const rawHref = (links[i][1] || '').trim();
    const titleHtml = links[i][2] || '';
    const snippetHtml = snippets[i] ? snippets[i][1] : '';

    const title = titleHtml.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const snippet = snippetHtml.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const url = unwrapDDG(rawHref);

    if (title && url && !url.includes('duckduckgo.com/y.js')) {
      results.push({ title, url, snippet, trust: trustScore(url) });
    }
  }

  // Fallback: try to extract from any <a class="result"> blocks if no results found
  if (results.length === 0) {
    const fallbackRe = /<a [^>]*href="([^"]+)"[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)<\/a>/gi;
    const fallbackLinks = [...html.matchAll(fallbackRe)];
    for (let i = 0; i < fallbackLinks.length && results.length < 5; i++) {
      const rawHref = (fallbackLinks[i][1] || '').trim();
      const titleHtml = fallbackLinks[i][2] || '';
      const title = titleHtml.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      const url = unwrapDDG(rawHref);
      if (title && url && !url.includes('duckduckgo.com/y.js') && !url.includes('amazon.com') && !url.includes('eBay')) {
        results.push({ title, url, snippet: '', trust: trustScore(url) });
      }
    }
  }

  return results;
}

async function webSearch(query, options = {}) {
  const maxResults = Math.min(Math.max(1, options.maxResults || config.tools.webSearch.maxResults), 10);

  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: false, error: 'Query must be a non-empty string', query };
  }

  query = query.trim();

  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`[webSearch] Query: "${query}"`);

    const html = await fetchWithBackoff(url);
    console.log(`[webSearch] HTML length: ${html.length}`);

    const allResults = parseResults(html);
    console.log(`[webSearch] Total results parsed: ${allResults.length}`);

    const filtered = allResults
      .filter(r => r.title && r.url && !r.url.includes('amazon.com') && !r.url.includes('eBay'))
      .slice(0, maxResults);

    if (filtered.length === 0) {
      return { success: true, results: [], query, note: 'No results found' };
    }

    const results = filtered.map(r => ({
      title: r.title,
      link: r.url,
      snippet: r.snippet || '',
      trust: r.trust,
    }));

    return { success: true, results, query, count: results.length };

  } catch (err) {
    console.error(`[webSearch] Failed: ${err.message}`);
    return { success: false, error: err.message, query };
  }
}

module.exports = webSearch;
