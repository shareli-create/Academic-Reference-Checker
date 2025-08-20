// netlify/functions/verify.js
const fetch = require('node-fetch');

// Using the built-in fetch available in modern Node.js environments on Netlify.
// No 'node-fetch' dependency is required.

exports.handler = async function(event) {
  console.log('Function invoked. Method:', event.httpMethod);

  if (event.httpMethod !== 'POST') {
    console.log('Invalid method. Returning 405.');
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    console.log('Parsing request body...');
    const { referenceText } = JSON.parse(event.body);

    if (!referenceText) {
      console.log('Bad Request: referenceText is missing.');
      return { statusCode: 400, body: 'Bad Request: referenceText is required.' };
    }
    console.log('Received reference text:', referenceText);

    // IMPORTANT: Remember to replace this with your actual email
    const yourEmail = 'name@example.com';
    const apiUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(referenceText)}&rows=1&mailto=${yourEmail}`;

    console.log('Calling CrossRef API:', apiUrl);
    const response = await fetch(apiUrl);
    console.log('CrossRef API response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('CrossRef API Error:', response.status, errorBody);
      return { statusCode: response.status, body: `CrossRef API Error: ${response.statusText}. Details: ${errorBody}` };
    }

    const data = await response.json();
    console.log('Successfully received data from CrossRef.');

    let status = 'Not Found ❌';
    let details = 'Reference not found in CrossRef database.';

    if (data.message && data.message.items && data.message.items.length > 0) {
      const topResult = data.message.items[0];
      const returnedTitle = topResult.title ? topResult.title[0] : '';

      const inputWords = referenceText.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const titleWords = new Set(returnedTitle.toLowerCase().match(/\b\w{4,}\b/g) || []);

      const matchingWords = inputWords.filter(word => titleWords.has(word));

      if (matchingWords.length >= 2) {
          status = 'Verified ✓';
          details = `Match found: "${returnedTitle}"`;
          if (topResult.DOI) {
            details += ` (DOI: ${topResult.DOI})`;
          }
      } else if (matchingWords.length > 0) {
          status = 'Partially Verified ⚠️';
          details = `Potential match with low confidence: "${returnedTitle}"`;
      }
    }

    console.log('Returning success response:', { status, details });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, details }),
    };

  } catch (error) {
    console.error('FATAL_ERROR:', error);
    return {
      statusCode: 500,
      body: `Server Error: An internal error occurred. Check function logs for details. Message: ${error.message}`
    };
  }
};
