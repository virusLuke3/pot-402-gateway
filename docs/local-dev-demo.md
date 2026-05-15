# Local Portaldot Dev Chain Demo

This document is the judge-facing proof path for running POT-402 Gateway without mainnet funds.

## What this proves

- The gateway issues an HTTP `402 Payment Required` challenge.
- The challenge maps to a native Portaldot/Substrate `balances.transferKeepAlive(dest, value)` call.
- A real transaction can be submitted to a Portaldot local development node.
- The gateway records the tx hash, block hash, events, amount, payer, recipient, and verification status.
- The verified receipt unlocks the protected API response.

## Safety model

- This mode only talks to `ws://127.0.0.1:9944` by default.
- The server rejects public RPC endpoints for local-dev payments.
- It uses well-known public Substrate dev accounts such as `//Alice`.
- It does not request a private key, mnemonic, wallet seed, GitHub token, or API key.
- It does not use `wss://mainnet.portaldot.io` for writes.

## Start Portaldot local dev node

Download the official local development client from Portaldot docs / GitHub:

- macOS: `https://github.com/portaldotVolunteer/Portaldot-node/raw/main/portaldot-testnet-macos.tar.gz`
- Ubuntu: `https://github.com/portaldotVolunteer/Portaldot-node/raw/main/portaldot-testnet-ubuntu.tar.gz`

Run:

```bash
tar -xzvf portaldot-testnet-macos.tar.gz
cd portaldot-testnet-macos
chmod 755 portaldot_dev
xattr -cr portaldot_dev  # macOS only, if Gatekeeper blocks it
./portaldot_dev --dev --alice
```

Expected local RPC:

```text
ws://127.0.0.1:9944
```

## Start POT-402 Gateway in local-dev mode

```bash
npm install
POT402_MODE=local-dev POT402_LOCAL_RPC=ws://127.0.0.1:9944 npm start
```

Open:

```text
http://localhost:4020
```

## Demo steps

### One-click path

1. Click **Run Full Local Dev Demo**.
2. Confirm the challenge panel shows the generated 402 challenge.
3. Confirm the receipt panel shows:
   - `mode: local-dev-chain`
   - `verification.status: verified_local_dev_chain`
   - tx hash
   - block hash
   - payer `Alice`
   - recipient
   - amount
4. Confirm the unlock panel shows the paid API response.

### Step-by-step path

1. Click **Call Protected API**.
2. Confirm the challenge includes:
   - token: `POT`
   - decimals: `14`
   - suggested extrinsic: `Balances.transferKeepAlive`
   - recipient: demo gateway address
   - amount: product amount in planck
3. Click **Preview Local Dev Transfer**.
4. Confirm the preview says:
   - network: `Portaldot Local Development Network`
   - RPC: `ws://127.0.0.1:9944`
   - payer: `Alice` / `//Alice`
   - safety: `local_only_no_mainnet_funds`
5. Click **Submit Local Dev Transfer**.
6. Confirm the receipt contains:
   - `mode: local-dev-chain`
   - `verification.status: verified_local_dev_chain`
   - tx hash
   - block hash
   - `balances.Transfer` event if emitted by the runtime
7. Click **Unlock Premium Response**.
8. Confirm the protected API returns HTTP 200 and the paid payload.

## CLI verification

Create a challenge:

```bash
curl -s -X POST http://localhost:4020/api/challenges \
  -H 'content-type: application/json' \
  -d '{"productId":"weather","payer":"judge-demo"}'
```

Preview local transfer:

```bash
curl -s -X POST http://localhost:4020/api/receipts/local-dev/preview \
  -H 'content-type: application/json' \
  -d '{"challengeId":"<challenge-id>","payer":"Alice"}'
```

One-click local demo:

```bash
curl -s -X POST http://localhost:4020/api/demo/local-dev \
  -H 'content-type: application/json' \
  -d '{"productId":"weather","payer":"Alice"}'
```

Submit local transfer:

```bash
curl -s -X POST http://localhost:4020/api/receipts/local-dev \
  -H 'content-type: application/json' \
  -d '{"challengeId":"<challenge-id>","payer":"Alice"}'
```

Unlock protected API:

```bash
curl -s http://localhost:4020/api/protected/weather \
  -H 'Authorization: Bearer <access-token>'
```

## Current host note

The official macOS binary available during development was an x86_64 Mach-O executable. On Apple Silicon hosts it requires Rosetta, or the Portaldot node must be built from source / run on an x86_64 host. The application code and tests are ready for the local node once `ws://127.0.0.1:9944` is available.
