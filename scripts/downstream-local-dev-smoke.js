const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.POT402_MODE = 'local-dev';
process.env.POT402_LOCAL_RPC = process.env.POT402_LOCAL_RPC || 'ws://127.0.0.1:9944';
process.env.POT402_LEDGER_PATH = process.env.POT402_LEDGER_PATH || path.join(os.tmpdir(), `pot402-downstream-local-dev-smoke-${process.pid}.json`);

const { createApp } = require('../src/server');

async function main() {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const idea = 'POT-402 pay-per-call APIs for Portaldot builders';
  try {
    const demoResponse = await fetch(`${baseUrl}/api/demo/downstream/hackathon-report/local-dev`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea, payer: 'Alice' }),
    });
    const demoBody = await demoResponse.json();
    if (demoResponse.status !== 201) {
      throw new Error(`Expected downstream local demo 201, got ${demoResponse.status}: ${JSON.stringify(demoBody)}`);
    }
    if (!demoBody.ok || demoBody.downstream.verification.status !== 'accepted_verified_local_dev_chain_receipt') {
      throw new Error(`Unexpected downstream demo payload: ${JSON.stringify(demoBody)}`);
    }
    if (demoBody.downstream.report.title !== 'POT-402 Verified Hackathon Report') {
      throw new Error(`Expected unlocked hackathon report, got: ${JSON.stringify(demoBody.downstream.report)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      message: 'DOWNSTREAM_LOCAL_DEV_SMOKE_OK',
      baseUrl,
      scenario: demoBody.scenario,
      mode: demoBody.mode,
      txHash: demoBody.upstream.receipt.txHash,
      blockHash: demoBody.upstream.receipt.blockHash,
      payer: demoBody.upstream.receipt.payer,
      recipient: demoBody.upstream.receipt.recipient,
      amountPOT: demoBody.upstream.receipt.amountPOT,
      verification: demoBody.upstream.receipt.verification.status,
      downstreamVerification: demoBody.downstream.verification.status,
      unlockedReport: demoBody.downstream.report.title,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try { fs.unlinkSync(process.env.POT402_LEDGER_PATH); } catch (_) {}
  }
}

main().catch((error) => {
  console.error('DOWNSTREAM_LOCAL_DEV_SMOKE_FAILED');
  console.error(error.message);
  console.error('Make sure ./portaldot_dev --dev --alice is running and ws://127.0.0.1:9944 is reachable.');
  process.exit(1);
});
