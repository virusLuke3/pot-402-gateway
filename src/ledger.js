const fs = require('node:fs');
const path = require('node:path');

function emptyLedger() {
  return { challenges: [], receipts: [], accessTokens: [] };
}

function ensureLedgerFile(ledgerPath) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  if (!fs.existsSync(ledgerPath)) {
    fs.writeFileSync(ledgerPath, JSON.stringify(emptyLedger(), null, 2));
  }
}

function readLedger(ledgerPath) {
  ensureLedgerFile(ledgerPath);
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    return {
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
      accessTokens: Array.isArray(parsed.accessTokens) ? parsed.accessTokens : [],
    };
  } catch (error) {
    const corruptPath = `${ledgerPath}.corrupt-${Date.now()}`;
    fs.renameSync(ledgerPath, corruptPath);
    const fresh = emptyLedger();
    fs.writeFileSync(ledgerPath, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function writeLedger(ledgerPath, ledger) {
  ensureLedgerFile(ledgerPath);
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
}

function resetLedger(ledgerPath) {
  const fresh = emptyLedger();
  writeLedger(ledgerPath, fresh);
  return fresh;
}

module.exports = { emptyLedger, ensureLedgerFile, readLedger, writeLedger, resetLedger };
