const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.POT402_MODE = 'local-dev';
process.env.POT402_LOCAL_RPC = process.env.POT402_LOCAL_RPC || 'ws://127.0.0.1:9944';
process.env.POT402_LEDGER_PATH = process.env.POT402_LEDGER_PATH || path.join(os.tmpdir(), `pot402-local-dev-smoke-${process.pid}.json`);

const { createApp } = require('../src/server');

async function main() {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const challengeResponse = await fetch(`${baseUrl}/api/protected/weather`);
    if (challengeResponse.status !== 402) {
      throw new Error(`Expected protected API to return 402, got ${challengeResponse.status}`);
    }
    const challengeBody = await challengeResponse.json();
    const challengeId = challengeBody.challenge.id;

    const previewResponse = await fetch(`${baseUrl}/api/receipts/local-dev/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId, payer: 'Alice' }),
    });
    if (previewResponse.status !== 200) {
      throw new Error(`Expected local preview 200, got ${previewResponse.status}: ${await previewResponse.text()}`);
    }

    const receiptResponse = await fetch(`${baseUrl}/api/receipts/local-dev`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId, payer: 'Alice' }),
    });
    const receiptBody = await receiptResponse.json();
    if (receiptResponse.status !== 201) {
      throw new Error(`Expected local receipt 201, got ${receiptResponse.status}: ${JSON.stringify(receiptBody)}`);
    }

    const token = receiptBody.accessToken.token;
    const unlockedResponse = await fetch(`${baseUrl}/api/protected/weather`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (unlockedResponse.status !== 200) {
      throw new Error(`Expected unlock 200, got ${unlockedResponse.status}: ${await unlockedResponse.text()}`);
    }
    const unlockedBody = await unlockedResponse.json();
    if (!unlockedBody.ok || unlockedBody.receipt.verification.status !== 'verified_local_dev_chain') {
      throw new Error(`Unexpected unlock payload: ${JSON.stringify(unlockedBody)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      message: 'LOCAL_DEV_SMOKE_OK',
      baseUrl,
      txHash: receiptBody.receipt.txHash,
      blockHash: receiptBody.receipt.blockHash,
      payer: receiptBody.receipt.payer,
      recipient: receiptBody.receipt.recipient,
      amountPlanck: receiptBody.receipt.amountPlanck,
      verification: receiptBody.receipt.verification.status,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try { fs.unlinkSync(process.env.POT402_LEDGER_PATH); } catch (_) {}
  }
}

main().catch((error) => {
  console.error('LOCAL_DEV_SMOKE_FAILED');
  console.error(error.message);
  console.error('Make sure ./portaldot_dev --dev --alice is running and ws://127.0.0.1:9944 is reachable.');
  process.exit(1);
});
