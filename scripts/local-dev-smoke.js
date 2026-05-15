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
    const demoResponse = await fetch(`${baseUrl}/api/demo/local-dev`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'weather', payer: 'Alice' }),
    });
    const demoBody = await demoResponse.json();
    if (demoResponse.status !== 201) {
      throw new Error(`Expected one-click local demo 201, got ${demoResponse.status}: ${JSON.stringify(demoBody)}`);
    }
    if (!demoBody.ok || demoBody.receipt.verification.status !== 'verified_local_dev_chain') {
      throw new Error(`Unexpected local demo payload: ${JSON.stringify(demoBody)}`);
    }
    if (!demoBody.unlock.ok || !demoBody.unlock.data.unlocked) {
      throw new Error(`Expected unlocked premium payload, got: ${JSON.stringify(demoBody.unlock)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      message: 'LOCAL_DEV_SMOKE_OK',
      baseUrl,
      mode: demoBody.mode,
      demoSteps: demoBody.demoSteps,
      txHash: demoBody.receipt.txHash,
      blockHash: demoBody.receipt.blockHash,
      payer: demoBody.receipt.payer,
      recipient: demoBody.receipt.recipient,
      amountPlanck: demoBody.receipt.amountPlanck,
      verification: demoBody.receipt.verification.status,
      unlockedProduct: demoBody.unlock.data.product,
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
