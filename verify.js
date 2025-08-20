// A serverless function to act as a proxy for the CrossRef API
// to get around browser CORS security restrictions.

const fetch = require('node-fetch');

exports.handler = async function(event) {
  // We only accept POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { referenceText } = JSON.parse(event.body);

    if (!referenceText) {
      return { statusCode: 400, body: 'Bad Request: referenceText is required.' };
    }

    // It's good practice to identify yourself to the CrossRef API.
    // Replace with a real email for better service.
    const yourEmail = 'name@example.com'; 
    const apiUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(referenceText)}&rows=1&mailto=${yourEmail}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      return { statusCode: response.status, body: `CrossRef API Error: ${response.statusText}` };
    }

    const data = await response.json();

    let status = 'Not Found ❌';
    let details = 'Reference not found in CrossRef database.';

    if (data.message && data.message.items && data.message.items.length > 0) {
      const topResult = data.message.items[0];
      const returnedTitle = topResult.title ? topResult.title[0] : '';
      
      // A simple check to see if the result is plausible
      const inputWords = referenceText.toLowerCase().match(/\b\w{4,}\b/g) || []; // get words of 4+ chars
      const titleWords = new Set(returnedTitle.toLowerCase().match(/\b\w{4,}\b/g) || []);
      
      const matchingWords = inputWords.filter(word => titleWords.has(word));

      if (matchingWords.length >= 2) { // If at least 2 long words match, consider it verified.
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
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, details }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: `Server Error: ${error.message}`
    };
  }
};
