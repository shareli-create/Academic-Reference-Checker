// netlify/functions/verify.js
const fetch = require('node-fetch');

const YOUR_EMAIL = 'name@example.com'; // IMPORTANT: Replace with your email for politeness pools

// --- Helper function for CrossRef ---
const checkCrossRef = async (referenceText) => {
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(referenceText)}&rows=1&mailto=${YOUR_EMAIL}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CrossRef API error: ${response.statusText}`);
  const data = await response.json();
  if (data.message.items.length > 0) {
    const item = data.message.items[0];
    const title = item.title ? item.title[0] : 'N/A';
    return { status: 'Verified ✓', details: `Match found: ${title}` };
  }
  return { status: 'Not Found ❌', details: 'No match found.' };
};

// --- Helper function for PubMed ---
const checkPubMed = async (referenceText) => {
    // E-utilities require a two-step search: 1. get ID, 2. get summary
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(referenceText)}&retmode=json&rows=1`;
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) throw new Error(`PubMed ESearch API error: ${searchResponse.statusText}`);
    const searchData = await searchResponse.json();
    
    const idList = searchData.esearchresult?.idlist;
    if (!idList || idList.length === 0) {
        return { status: 'Not Found ❌', details: 'No match found.' };
    }

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList[0]}&retmode=json`;
    const summaryResponse = await fetch(summaryUrl);
    if (!summaryResponse.ok) throw new Error(`PubMed ESummary API error: ${summaryResponse.statusText}`);
    const summaryData = await summaryResponse.json();
    
    const title = summaryData.result?.[idList[0]]?.title || 'N/A';
    return { status: 'Verified ✓', details: `Match found: ${title}` };
};

// --- Helper function for Semantic Scholar ---
const checkSemanticScholar = async (referenceText) => {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(referenceText)}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Semantic Scholar API error: ${response.statusText}`);
  const data = await response.json();
  if (data.total > 0 && data.data.length > 0) {
    const item = data.data[0];
    return { status: 'Verified ✓', details: `Match found: ${item.title}` };
  }
  return { status: 'Not Found ❌', details: 'No match found.' };
};

// --- Helper function for OpenAlex ---
const checkOpenAlex = async (referenceText) => {
  const url = `https://api.openalex.org/works?filter=default.search:${encodeURIComponent(referenceText)}&per_page=1&mailto=${YOUR_EMAIL}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenAlex API error: ${response.statusText}`);
  const data = await response.json();
  if (data.results.length > 0) {
    const item = data.results[0];
    return { status: 'Verified ✓', details: `Match found: ${item.display_name}` };
  }
  return { status: 'Not Found ❌', details: 'No match found.' };
};


// --- Main Handler ---
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { referenceText } = JSON.parse(event.body);
    if (!referenceText) {
      return { statusCode: 400, body: 'Bad Request: referenceText is required.' };
    }

    const sources = {
      CrossRef: checkCrossRef(referenceText),
      PubMed: checkPubMed(referenceText),
      SemanticScholar: checkSemanticScholar(referenceText),
      OpenAlex: checkOpenAlex(referenceText),
    };

    const results = await Promise.allSettled(Object.values(sources));
    const sourceKeys = Object.keys(sources);

    const responsePayload = {};
    results.forEach((result, index) => {
      const key = sourceKeys[index];
      if (result.status === 'fulfilled') {
        responsePayload[key] = result.value;
      } else {
        responsePayload[key] = { status: 'Error ❌', details: result.reason.message };
      }
    });

    console.log("Response Payload:", JSON.stringify(responsePayload, null, 2));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responsePayload),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: `Server Error: ${error.message}`
    };
  }
};
