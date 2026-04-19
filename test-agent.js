require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const agentService = require('./src/services/agentService');

(async () => {
  console.log('=== Testing Full Agent Service ===\n');

  const testQueries = [
    'What is the latest AI news in April 2026?',
  ];

  for (const query of testQueries) {
    console.log(`\n--- Query: "${query}" ---\n`);
    try {
      const result = await agentService.processMessage(query, 'test-user-001');
      console.log('\n=== RESPONSE ===');
      console.log(result.reply || result.error || JSON.stringify(result, null, 2));
      if (result.usedTools?.length) {
        console.log('\n=== TOOLS USED ===');
        result.usedTools.forEach(t => console.log(`- ${t}`));
      }
    } catch (err) {
      console.error('Agent error:', err.message);
    }
  }
})();
