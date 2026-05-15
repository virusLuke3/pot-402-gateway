const path = require('node:path');

const POT_DECIMALS = 14;
const DEFAULT_RECIPIENT = '5E9oDs9PjpsBbxXxRE9uMaZZhnBAV38n2ouLB28oecBDdeQo';
const requestedMode = process.env.POT402_MODE || 'mock';
const mode = requestedMode === 'local-dev' ? 'local-dev' : 'mock';

const config = {
  appName: 'POT-402 Gateway',
  mode,
  requestedMode,
  port: Number(process.env.POT402_PORT || process.env.PORT || 4020),
  rpcUrl: process.env.POT402_RPC || 'wss://mainnet.portaldot.io',
  localRpcUrl: process.env.POT402_LOCAL_RPC || 'ws://127.0.0.1:9944',
  ss58Format: 42,
  token: 'POT',
  decimals: POT_DECIMALS,
  recipient: process.env.POT402_RECIPIENT || DEFAULT_RECIPIENT,
  amountPOT: '0.0010',
  amountPlanck: String(10n ** 11n), // 0.001 POT when decimals = 14
  ledgerPath: process.env.POT402_LEDGER_PATH || path.join(__dirname, '..', 'data', 'ledger.json'),
  challengeTTLSeconds: 15 * 60,
};

module.exports = { config, POT_DECIMALS };
