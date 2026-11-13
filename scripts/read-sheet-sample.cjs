const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filename) {
  const envPath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1iCrT4uEyqf62KqS6UziQFBxLQ4ukAGWH';
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Book time with Silvia';
  const impersonateServiceAccount = process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT;

  console.log(`[ADC Sheet Reader] Target Spreadsheet ID: ${spreadsheetId}`);
  console.log(`[ADC Sheet Reader] Target Tab: "${tabName}"`);
  console.log(`[ADC Sheet Reader] Range: A1:R10 (Header + sample rows)`);
  console.log(`[ADC Sheet Reader] valueRenderOption: FORMATTED_VALUE`);
  if (impersonateServiceAccount) {
    console.log(`[ADC Sheet Reader] Impersonating Service Account: ${impersonateServiceAccount}`);
  }
  console.log('');

  try {
    const authOptions = {
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    };

    if (impersonateServiceAccount) {
      authOptions.clientOptions = {
        impersonateServiceAccount,
      };
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:Z10`,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in range.');
      return;
    }

    console.log('====================================================');
    console.log('ACTUAL HEADER ROW (Row 1):');
    console.log('====================================================');
    rows[0].forEach((header, index) => {
      const colLetter = String.fromCharCode(65 + index);
      console.log(`  Col ${colLetter} (${index + 1}): "${header}"`);
    });

    console.log('\n====================================================');
    console.log('SAMPLE DATA ROWS:');
    console.log('====================================================');
    for (let r = 1; r < rows.length; r++) {
      console.log(`\n--- Row ${r + 1} ---`);
      const rowData = rows[r];
      rows[0].forEach((header, index) => {
        const colLetter = String.fromCharCode(65 + index);
        const cellValue = rowData && rowData[index] !== undefined ? rowData[index] : '(empty)';
        console.log(`  ${colLetter} [${header}]: ${cellValue}`);
      });
    }
    console.log('\n====================================================');
    console.log('Read completed successfully.');
  } catch (error) {
    console.error('\n[Error Reading Sheet]:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.errors) console.error('Error Details:', JSON.stringify(error.errors, null, 2));
    process.exit(1);
  }
}

main();
