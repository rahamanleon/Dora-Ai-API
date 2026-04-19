/**
 * Dora Tool - Advanced AI-powered web research and synthesis
 * 
 * A versatile tool that combines web search, content fetching,
 * and AI-powered synthesis for comprehensive research tasks.
 * 
 * @author Leox (Rahaman Leon)
 * @license MIT
 */

const axios = require('axios');

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Search DuckDuckGo for a query
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results (default: 5)
 * @returns {Promise<Array>} Array of search results
 */
async function search(query, maxResults = 5) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html',
      },
      timeout: 15000,
    });

    const results = [];
    const html = response.data;
    
    // Parse result snippets from DuckDuckGo HTML
    const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;
    
    while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
      const link = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();
      
      results.push({
        title,
        link,
        snippet
      });
      count++;
    }

    // Fallback: simple link + title extraction
    if (results.length === 0) {
      const linkRegex = /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        if (title && !title.includes('&amp')) {
          results.push({
            title,
            link: match[1],
            snippet: ''
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

/**
 * Fetch content from a URL and extract readable text
 * @param {string} url - URL to fetch
 * @param {number} maxChars - Maximum characters to return (default: 3000)
 * @returns {Promise<string>} Extracted text content
 */
async function fetchUrl(url, maxChars = 3000) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    let content = response.data;
    
    // Remove scripts, styles, nav, footer, header
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    content = content.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    
    // Extract readable text from key tags
    let readable = '';
    const tags = ['p', 'h1', 'h2', 'h3', 'h4', 'li', 'article', 'section'];
    
    for (const tag of tags) {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      let m;
      while ((m = regex.exec(content)) !== null) {
        const text = m[1].replace(/<[^>]*>/g, '').trim();
        if (text) readable += text + '\n\n';
      }
    }
    
    // Fallback: get all text
    if (!readable) {
      readable = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // Cap at maxChars
    if (readable.length > maxChars) {
      readable = readable.substring(0, maxChars) + '\n\n[... content truncated ...]';
    }
    
    return readable;
  } catch (error) {
    console.error('Fetch error:', error.message);
    return `Error fetching URL: ${error.message}`;
  }
}

/**
 * Main tool function - research a topic
 * @param {object} args - { query: string, depth?: 'quick'|'normal'|'deep' }
 * @returns {Promise<object>} Research results
 */
async function doraTool(args) {
  const { query, depth = 'normal' } = args;
  
  if (!query) {
    return { error: 'Query is required' };
  }

  const maxResults = depth === 'quick' ? 3 : depth === 'deep' ? 10 : 5;
  
  // Step 1: Search
  const searchResults = await search(query, maxResults);
  
  if (searchResults.length === 0) {
    return { 
      query,
      error: 'No search results found',
      tips: 'Try different keywords or check your internet connection'
    };
  }

  // Step 2: Fetch top results
  const enrichedResults = [];
  const fetchLimit = depth === 'quick' ? 1 : depth === 'deep' ? 5 : 3;
  
  for (let i = 0; i < Math.min(fetchLimit, searchResults.length); i++) {
    const result = searchResults[i];
    const content = await fetchUrl(result.link, 2000);
    enrichedResults.push({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      content: content.substring(0, 1000) + (content.length > 1000 ? '...' : '')
    });
  }

  return {
    query,
    depth,
    totalFound: searchResults.length,
    topResults: enrichedResults,
    allLinks: searchResults.map(r => ({ title: r.title, link: r.link }))
  };
}

module.exports = { doraTool, search, fetchUrl };
