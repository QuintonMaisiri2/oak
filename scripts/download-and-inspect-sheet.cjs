const https = require('https');
const fs = require('fs');
const path = require('path');

const downloadUrl = 'https://drive.usercontent.google.com/download?id=1iCrT4uEyqf62KqS6UziQFBxLQ4ukAGWH&export=download';
const destPath = path.resolve(__dirname, 'silvia_sheet.xlsx');

console.log('Downloading file from Google Drive...');

function download(url) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      download(res.headers.location);
      return;
    }

    if (res.statusCode !== 200) {
      console.error('Failed with status:', res.statusCode);
      return;
    }

    const fileStream = fs.createWriteStream(destPath);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      const stats = fs.statSync(destPath);
      console.log(`Downloaded ${stats.size} bytes to ${destPath}`);

      // Try reading with xlsx if installed or check buffer
      const buffer = fs.readFileSync(destPath);
      console.log('Magic bytes (ASCII):', buffer.slice(0, 10).toString('ascii'));
    });
  }).on('error', err => console.error('Download error:', err));
}

download(downloadUrl);
