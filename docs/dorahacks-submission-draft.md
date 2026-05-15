# DoraHacks submission draft

## Project name

POT-402 Gateway

## Tagline

Portaldot-native pay-per-call APIs using HTTP 402 and POT payment proofs.

## Short description

POT-402 Gateway lets a Portaldot builder put a price on an API endpoint. The protected API returns `402 Payment Required` with a Portaldot/POT payment challenge. After the payment proof is verified, the API returns the paid response.

The current MVP runs in safe mode: it demonstrates the full challenge, receipt, ledger, and unlock flow without broadcasting a transaction. The real-payment path is documented around Portaldot's native `balances.transferKeepAlive` extrinsic and should be enabled only after wallet/funds confirmation.

## Problem

Small builders often do not need a full marketplace. They need a quick way to charge for one API call, one data feed, one creator resource, or one tool output. On Portaldot, that should feel native: POT payment, Substrate-style proof, and a clear unlock event.

## Solution

POT-402 Gateway turns API access into a Portaldot payment challenge:

1. User calls a protected endpoint.
2. Gateway returns HTTP 402 with amount, recipient, network, and suggested Portaldot payment call.
3. User pays POT or uses safe demo simulation.
4. Gateway verifies the receipt and returns an access token.
5. The protected API unlocks and stores a receipt trail.

## Portaldot integration

- Chain RPC: `wss://mainnet.portaldot.io`
- Token: `POT`
- Decimals: `14`
- SS58 format: `42`
- Native payment primitive: `balances.transferKeepAlive(dest, value)`
- Read-only RPC status endpoint: `/api/chain/status`

## Tracks

Primary: Native Onchain Apps
Secondary: Builder Tools for Portaldot

## What is working now

- Local web demo
- Protected API returns HTTP 402
- Structured Portaldot/POT payment challenge
- Safe receipt simulation
- Access-token unlock flow
- Redacted receipt ledger
- Read-only Portaldot RPC status check
- Node test suite and smoke test
- README, demo script, architecture docs

## Demo instructions

```bash
npm test
npm run smoke
npm start
```

Open:

```text
http://localhost:4020
```

Then:

1. Click "Call Protected API".
2. Inspect the HTTP 402 payment challenge.
3. Click "Simulate Portaldot Payment".
4. Click "Unlock Premium Response".
5. Click "Check Portaldot RPC".

## Safety and honesty note

This MVP does not broadcast Portaldot transactions by default. Mock receipts are clearly labeled as mock receipts. A real transaction demo should use a wallet-controlled account and only happen after explicit confirmation.

## Links to include before final submission

- GitHub repo: TODO, requires public/private publishing decision
- Live demo URL: TODO, requires deployment confirmation
- Demo video: TODO, record after final local/public demo is approved
- Optional real transaction hash: TODO, requires wallet/funds and transaction confirmation
