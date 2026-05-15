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
$('unlock-api').addEventListener('click', unlockApi);
$('chain-status').addEventListener('click', checkChainStatus);
