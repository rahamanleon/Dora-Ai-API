/**
 * Fetch URL Tool - Extract readable content from any webpage
 */
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');

async function fetchUrl(url, options = {}) {
  const maxChars = options.maxChars || config.tools.fetchUrl.maxChars;

  if (!url || typeof url !== 'string') {
    return { success: false, error: 'URL must be a non-empty string', url };
  }

  // Basic URL validation and repair
  let normalizedUrl = url.trim();

  try {
    new URL(normalizedUrl);
  } catch {
    // Try prepending https:// for bare domains/paths
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    try {
      new URL(normalizedUrl);
    } catch {
      return { success: false, error: 'Invalid URL format', url };
    }
  }

  try {
    console.log(`[fetchUrl] Fetching: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: config.tools.fetchUrl.timeout,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Remove noise elements
    $('script, style, noscript, iframe, svg, nav, footer, header, aside, form, button, input, [role="navigation"], [role="banner"], [role="complementary"]').remove();

    // Extract title
    const title = $('title').text().trim() || $('h1').first().text().trim() || '';

    // Extract meta description
    const metaDesc = $('meta[name="description"]').attr('content') || '';

    // Extract main content - prioritize article, main, and content containers
    let content = '';
    const contentSelectors = ['article', 'main', '[role="main"]', '.content', '.post', '.article', '#content', '.entry-content', '.post-content'];

    for (const selector of contentSelectors) {
      const el = $(selector).first();
      if (el.length) {
        el.find('aside, .sidebar, .ad, .advertisement, .related, .comments').remove();
        content = el.text();
        break;
      }
    }

    // Fallback to paragraph extraction
    if (!content) {
      $('p, h1, h2, h3, h4, h5, h6, li').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 30) {
          content += text + '\n\n';
        }
      });
    }

    // Clean up whitespace
    content = content.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();

    const result = {
      success: true,
      title: title.substring(0, 200),
      description: metaDesc.substring(0, 300),
      url,
      content: content.substring(0, maxChars),
      truncated: content.length > maxChars,
    };

    console.log(`[fetchUrl] Title: "${result.title}", Content: ${result.content.length} chars`);
    return result;

  } catch (err) {
    console.error(`[fetchUrl] Error: ${err.message}`);
    return {
      success: false,
      error: err.message,
      url,
    };
  }
}

module.exports = fetchUrl;
