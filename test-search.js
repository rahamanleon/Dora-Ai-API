require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

const query = 'latest AI news 2026';
const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);

console.log('Fetching:', url);

axios.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  timeout: 15000
}).then(res => {
  console.log('Status:', res.status);
  console.log('HTML length:', res.data.length);
  const $ = cheerio.load(res.data);
  const results = $('.result');
  console.log('Results found:', results.length);
  console.log('First few results:');
  results.slice(0, 3).each((i, el) => {
    const title = $(el).find('.result__title').text().trim();
    console.log((i+1) + '. ' + title.substring(0, 100));
  });
  // Check if maybe class names are different
  console.log('\nLooking for other patterns...');
  console.log('a.result links:', $('a.result').length);
  console.log('.links organic:', $('.links.organic').length);
  // Show some HTML structure
  const firstResult = $('.result').first().html();
  if (firstResult) {
    console.log('\nFirst result HTML (first 300 chars):');
    console.log(firstResult.substring(0, 300));
  }
}).catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('HTTP Status:', err.response.status);
    console.error('Body:', err.response.data.substring(0, 300));
  }
});
