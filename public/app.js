let currentChallenge = null;
let currentReceipt = null;
let currentAccessToken = null;

const $ = (id) => document.getElementById(id);
const pretty = (value) => JSON.stringify(value, null, 2);

async function callProtectedApi() {
  const res = await fetch('/api/protected/weather');
  const body = await res.json();
  currentChallenge = body.challenge;
  $('challenge-output').textContent = `HTTP ${res.status}\n\n${pretty(body)}`;
  $('simulate-payment').disabled = false;
  $('receipt-output').textContent = 'Challenge ready. Simulate payment or use real mode after approval.';
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

async function unlockApi() {
  if (!currentAccessToken) return;
  const res = await fetch(`/api/protected/weather?accessToken=${encodeURIComponent(currentAccessToken)}`);
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
$('unlock-api').addEventListener('click', unlockApi);
$('chain-status').addEventListener('click', checkChainStatus);
