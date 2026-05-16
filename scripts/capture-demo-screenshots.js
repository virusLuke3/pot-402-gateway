const fs = require('node:fs');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Missing Playwright. Install screenshot tooling first:');
  console.error('  npm run screenshots:install');
  console.error('Then rerun:');
  console.error('  npm run screenshots');
  process.exit(1);
}

const baseUrl = process.env.POT402_BASE_URL || 'http://127.0.0.1:4020';
const outDir = path.join(__dirname, '..', 'docs', 'assets', 'screenshots');
const idea = process.env.POT402_SCREENSHOT_IDEA || 'POT-402 pay-per-call APIs for Portaldot builders';

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function writeText(fileName, content) {
  fs.writeFileSync(path.join(outDir, fileName), content);
}

async function screenshot(page, fileName, options = {}) {
  const filePath = path.join(outDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true, ...options });
  console.log(`captured ${filePath}`);
  return filePath;
}

async function fetchJsonInPage(page, url, body) {
  return page.evaluate(async ({ url, body }) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, { url, body });
}

async function setPanelText(page, panels) {
  await page.evaluate((panels) => {
    for (const [id, value] of Object.entries(panels)) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
  }, panels);
}

function summarizeReceipt(receipt) {
  return {
    id: receipt.id,
    type: receipt.type,
    mode: receipt.mode,
    payer: receipt.payer,
    recipient: receipt.recipient,
    amountPOT: receipt.amountPOT,
    amountPlanck: receipt.amountPlanck,
    txHash: receipt.txHash,
    blockHash: receipt.blockHash,
    feePlanck: receipt.feePlanck,
    verification: receipt.verification,
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });

  const captured = [];
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('text=POT-402 Gateway').waitFor({ timeout: 10_000 });
    captured.push(await screenshot(page, '01-home.png'));

    const unpaid = await fetchJsonInPage(page, '/api/downstream/hackathon-report', { idea, payer: 'Alice' });
    await setPanelText(page, {
      'challenge-output': `HTTP ${unpaid.status}\n\n${pretty(unpaid.body)}`,
      'receipt-output': 'Waiting for payment proof. The downstream service will reject mock receipts and require verified_local_dev_chain.',
      'unlock-output': 'Waiting for downstream AI report unlock…',
    });
    captured.push(await screenshot(page, '02-downstream-402-challenge.png'));

    const demo = await fetchJsonInPage(page, '/api/demo/downstream/hackathon-report/local-dev', { idea, payer: 'Alice' });
    if (demo.status !== 201 || !demo.body.ok) {
      throw new Error(`Downstream demo failed with HTTP ${demo.status}: ${pretty(demo.body)}`);
    }

    const receiptPanel = {
      scenario: demo.body.scenario,
      mode: demo.body.mode,
      demoSteps: demo.body.demoSteps,
      upstreamReceipt: summarizeReceipt(demo.body.upstream.receipt),
      downstreamVerification: demo.body.downstream.verification,
      safety: demo.body.safety,
    };
    await setPanelText(page, {
      'challenge-output': `HTTP 402 challenge consumed\n\n${pretty(demo.body.upstream.challenge)}`,
      'receipt-output': `HTTP ${demo.status}\n\n${pretty(receiptPanel)}`,
      'unlock-output': pretty(demo.body.downstream.report),
    });
    captured.push(await screenshot(page, '03-local-dev-receipt-proof.png'));

    await page.locator('#unlock-output').scrollIntoViewIfNeeded();
    const reportPath = path.join(outDir, '04-unlocked-ai-report.png');
    await page.locator('#unlock-output').screenshot({ path: reportPath });
    console.log(`captured ${reportPath}`);
    captured.push(reportPath);

    await page.locator('#receipt-output').scrollIntoViewIfNeeded();
    const proofPath = path.join(outDir, '05-receipt-panel-closeup.png');
    await page.locator('#receipt-output').screenshot({ path: proofPath });
    console.log(`captured ${proofPath}`);
    captured.push(proofPath);

    const manifest = {
      capturedAt: new Date().toISOString(),
      baseUrl,
      idea,
      scenario: demo.body.scenario,
      mode: demo.body.mode,
      receipt: summarizeReceipt(demo.body.upstream.receipt),
      downstreamVerification: demo.body.downstream.verification.status,
      unlockedReport: demo.body.downstream.report.title,
      files: captured.map((filePath) => path.relative(path.join(__dirname, '..'), filePath)),
      safety: 'Screenshots use localhost Portaldot local dev node only; no mainnet funds or private keys are used.',
    };
    writeText('manifest.json', `${pretty(manifest)}\n`);
    writeText('README.md', `# Demo screenshots\n\nGenerated with:\n\n\`\`\`bash\nnpm run screenshots\n\`\`\`\n\nFiles:\n\n${manifest.files.map((file) => `- ${file}`).join('\n')}\n\nLatest proof:\n\n- txHash: \`${manifest.receipt.txHash}\`\n- blockHash: \`${manifest.receipt.blockHash}\`\n- verification: \`${manifest.receipt.verification.status}\`\n- downstream verification: \`${manifest.downstreamVerification}\`\n\nSafety: ${manifest.safety}\n`);

    console.log(pretty(manifest));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('SCREENSHOT_CAPTURE_FAILED');
  console.error(error.message);
  process.exit(1);
});
