let currentChallenge = null;
let currentReceipt = null;
let currentAccessToken = null;

const $ = (id) => document.getElementById(id);
const pretty = (value) => JSON.stringify(value, null, 2);

function setReceiptButtons(enabled) {
  $('simulate-payment').disabled = !enabled;
  $('preview-local-payment').disabled = !enabled;
  $('local-dev-payment').disabled = !enabled;
}

async function callProtectedApi() {
  const res = await fetch('/api/protected/weather');
  const body = await res.json();
  currentChallenge = body.challenge;
  $('challenge-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
  setReceiptButtons(Boolean(currentChallenge));
  $('receipt-output').textContent = 'Challenge ready. Use mock mode, or start portaldot_dev --dev --alice and use local-dev transfer mode.';
  $('unlock-output').textContent = 'Waiting for receipt…';
}

async function simulatePayment() {
  if (!currentChallenge) return;
  const res = await fetch('/api/receipts/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId: currentChallenge.id, payer: 'judge-demo' }),
  });
  const body = await res.json();
  currentReceipt = body.receipt;
  currentAccessToken = body.accessToken?.token;
  $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
  $('unlock-api').disabled = !currentAccessToken;
}

async function previewLocalDevPayment() {
  if (!currentChallenge) return;
  const res = await fetch('/api/receipts/local-dev/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId: currentChallenge.id, payer: 'Alice' }),
  });
  const body = await res.json();
  $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
}

async function submitLocalDevPayment() {
  if (!currentChallenge) return;
  $('receipt-output').textContent = 'Submitting balances.transferKeepAlive to local Portaldot dev node at ws://127.0.0.1:9944…';
  const res = await fetch('/api/receipts/local-dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId: currentChallenge.id, payer: 'Alice' }),
  });
  const body = await res.json();
  currentReceipt = body.receipt;
  currentAccessToken = body.accessToken?.token;
  $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
  $('unlock-api').disabled = !currentAccessToken;
}

async function runFullLocalDevDemo() {
  $('challenge-output').textContent = 'Creating challenge and running full local-dev proof…';
  $('receipt-output').textContent = 'Submitting one-click local dev demo to ws://127.0.0.1:9944…';
  $('unlock-output').textContent = 'Waiting for verified local receipt…';
  const res = await fetch('/api/demo/local-dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'weather', payer: 'Alice' }),
  });
  const body = await res.json();
  if (!res.ok) {
    $('challenge-output').textContent = 'One-click demo did not create a challenge.';
    $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
    $('unlock-output').textContent = 'Fix the local-dev node or input, then try again.';
    return;
  }
  currentChallenge = body.challenge;
  currentReceipt = body.receipt;
  currentAccessToken = body.accessToken?.token;
  $('challenge-output').textContent = `HTTP 402 equivalent challenge\n\n${pretty(body.challenge)}`;
  $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty({
    mode: body.mode,
    demoSteps: body.demoSteps,
    preview: body.preview,
    receipt: body.receipt,
    safety: body.safety,
  })}`;
  $('unlock-output').textContent = pretty(body.unlock);
  setReceiptButtons(Boolean(currentChallenge));
  $('unlock-api').disabled = !currentAccessToken;
}

async function runDownstreamReportDemo() {
  const idea = 'POT-402 pay-per-call APIs for Portaldot builders';
  $('challenge-output').textContent = 'Calling downstream AI Hackathon Report API without payment…';
  $('receipt-output').textContent = 'Waiting for downstream POT-402 challenge…';
  $('unlock-output').textContent = 'The downstream verifier will reject mock receipts and require verified_local_dev_chain.';

  const unpaid = await fetch('/api/downstream/hackathon-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idea, payer: 'Alice' }),
  });
  const unpaidBody = await unpaid.json();
  $('challenge-output').textContent = `HTTP ${unpaid.status}\n\n${pretty(unpaidBody)}`;
  if (!unpaidBody.challenge) {
    $('receipt-output').textContent = 'Downstream service did not return a POT-402 challenge.';
    return;
  }

  const res = await fetch('/api/demo/downstream/hackathon-report/local-dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idea, payer: 'Alice' }),
  });
  const body = await res.json();
  if (!res.ok) {
    $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
    $('unlock-output').textContent = 'Start the Portaldot local dev node and try the downstream demo again.';
    return;
  }

  currentChallenge = body.upstream.challenge;
  currentReceipt = body.upstream.receipt;
  currentAccessToken = null;
  $('receipt-output').textContent = `HTTP ${res.status}\n\n${pretty({
    scenario: body.scenario,
    mode: body.mode,
    demoSteps: body.demoSteps,
    upstreamReceipt: body.upstream.receipt,
    downstreamVerification: body.downstream.verification,
    safety: body.safety,
  })}`;
  $('unlock-output').textContent = pretty(body.downstream.report);
  setReceiptButtons(Boolean(currentChallenge));
  $('unlock-api').disabled = true;
}

async function unlockApi() {
  if (!currentAccessToken) return;
  const res = await fetch('/api/protected/weather?accessToken=' + encodeURIComponent(currentAccessToken));
  const body = await res.json();
  $('unlock-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
}

async function checkChainStatus() {
  $('chain-output').textContent = 'Checking read-only Portaldot RPC status…';
  const res = await fetch('/api/chain/status');
  const body = await res.json();
  $('chain-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
}

$('call-api').addEventListener('click', callProtectedApi);
$('simulate-payment').addEventListener('click', simulatePayment);
$('preview-local-payment').addEventListener('click', previewLocalDevPayment);
$('local-dev-payment').addEventListener('click', submitLocalDevPayment);
$('run-local-demo').addEventListener('click', runFullLocalDevDemo);
$('run-downstream-demo').addEventListener('click', runDownstreamReportDemo);
$('unlock-api').addEventListener('click', unlockApi);
$('chain-status').addEventListener('click', checkChainStatus);
