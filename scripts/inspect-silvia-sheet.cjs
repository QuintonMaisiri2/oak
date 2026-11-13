const https = require('https');

const sheetId = '1iCrT4uEyqf62KqS6UziQFBxLQ4ukAGWH';
const tabName = encodeURIComponent('Book time with Silvia');
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${tabName}`;

console.log('Fetching URL:', url);

function fetchUrl(targetUrl, redirects = 0) {
  if (redirects > 5) {
    console.error('Too many redirects');
    return;
  }
  https.get(targetUrl, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      fetchUrl(res.headers.location, redirects + 1);
      return;
    }

    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Final Status code:', res.statusCode);
      if (res.statusCode === 200) {
        console.log('--- CSV Content (first 3000 chars) ---');
        console.log(data.slice(0, 3000));
      } else {
        console.log('Response body preview:', data.slice(0, 500));
      }
    });
  }).on('error', err => console.error('Fetch error:', err));
}

fetchUrl(url);
