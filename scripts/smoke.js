const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const smokeLedgerPath = process.env.POT402_LEDGER_PATH || path.join(os.tmpdir(), `pot402-smoke-${process.pid}.json`);
const ownsSmokeLedger = !process.env.POT402_LEDGER_PATH;
process.env.POT402_LEDGER_PATH = smokeLedgerPath;

const { createApp } = require('../src/server');

async function main() {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    if (health.status !== 200) throw new Error(`health returned ${health.status}`);
    const protectedRes = await fetch(`${baseUrl}/api/protected/weather`);
    if (protectedRes.status !== 402) throw new Error(`protected API expected 402, got ${protectedRes.status}`);
    const challengeBody = await protectedRes.json();
    const receiptRes = await fetch(`${baseUrl}/api/receipts/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId: challengeBody.challenge.id, payer: 'smoke-demo' }),
    });
    if (receiptRes.status !== 201) throw new Error(`receipt expected 201, got ${receiptRes.status}`);
    const receiptBody = await receiptRes.json();
    const unlocked = await fetch(`${baseUrl}/api/protected/weather?accessToken=${receiptBody.accessToken.token}`);
    if (unlocked.status !== 200) throw new Error(`unlocked expected 200, got ${unlocked.status}`);
    console.log(`SMOKE_OK ${baseUrl}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (ownsSmokeLedger) {
      try { fs.unlinkSync(smokeLedgerPath); } catch (_) {}
    }
  }
}

main().catch((error) => {
  console.error('SMOKE_FAIL', error);
  process.exit(1);
});
