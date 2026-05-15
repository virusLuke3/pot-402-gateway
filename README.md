# POT-402 Gateway

Portaldot-native **HTTP 402 Payment Required** gateway for pay-per-call APIs.

Built for **Portaldot Online Mini Hackathon S1** targeting the 3,500 USDT prize pool.

## Why this exists

Portaldot builders need a simple primitive for monetizing APIs, data feeds, tools, creator resources, and builder services using native POT payments.

POT-402 Gateway demonstrates a small but reusable pattern:

1. A protected API returns `402 Payment Required`.
2. The response includes a Portaldot/POT payment challenge.
3. The user pays POT or, in safe local mode, simulates a receipt.
4. The gateway verifies the receipt and unlocks the API response.

## Hackathon fit

| Criteria | How this project addresses it |
|---|---|
| Portaldot Native Deployment | Uses Portaldot chain config, POT decimals, and native `balances.transferKeepAlive` as the payment proof primitive. |
| Demo Completion | Runnable local web app and API with a clear 402 → payment → unlock flow. |
| Application Value | Gives Portaldot builders a reusable API monetization primitive. |
| Presentation Quality | One-click protected API demo, receipt ledger, and concise proof story. |

## Portaldot facts used

- RPC: `wss://mainnet.portaldot.io`
- SS58 format: `42`
- Token: `POT`
- Decimals: `14`
- Native payment primitive: `balances.transferKeepAlive(dest, value)`

Sources:

- https://dorahacks.io/hackathon/portaldot-online-s1/tracks
- https://portaldot-dev.readthedocs.io/en/latest/chain-info.html
- https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html

## Safety boundary

This MVP starts in **safe mock mode**:

- It does **not** request private keys.
- It does **not** broadcast Portaldot transactions.
- It does **not** claim mock receipts are real on-chain transactions.

Real mode should replace the simulation step with an approved Polkadot.js / Portaldot wallet transaction using `balances.transferKeepAlive`. Any real transaction, public deployment, public GitHub publishing, or final submission requires explicit user confirmation.

## Run locally

```bash
npm test
npm run smoke
npm start
```

Open:

```text
http://localhost:4020
```

## Demo flow

1. Click **Call Protected API**.
2. Observe `HTTP 402` with a Portaldot/POT payment challenge.
3. Click **Simulate Portaldot Payment**.
4. Observe a deterministic mock tx hash and access token.
5. Click **Unlock Premium Response**.
6. Observe the paid API response and receipt proof.
7. Click **Check Portaldot RPC** for a read-only chain status check.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/chain/config` | GET | Portaldot chain config and docs links |
| `/api/chain/status` | GET | Read-only RPC status; never broadcasts tx |
| `/api/products` | GET | Demo paid API products |
| `/api/protected/weather` | GET | Protected API, returns 402 until access token is provided. Local demo supports `?accessToken=...`; public deployments should prefer `Authorization: Bearer <token>` to avoid logging tokens in URLs. |
| `/api/protected/builder_alpha` | GET | Second protected product |
| `/api/receipts/simulate` | POST | Create safe mock receipt for a challenge |
| `/api/ledger` | GET | Local receipt/access ledger |

## Architecture

See [`docs/architecture.md`](docs/architecture.md).

## Demo script

See [`docs/demo-script.md`](docs/demo-script.md).

## Submission checklist

See [`docs/submission-checklist.md`](docs/submission-checklist.md).

## Submission assets

- [DoraHacks submission draft](docs/dorahacks-submission-draft.md)
- [Pitch copy](docs/pitch.md)
- [Judge Q&A](docs/judge-qa.md)
- [Technical proof notes](docs/technical-proof.md)
- [Architecture diagram HTML](docs/pot-402-architecture.html)

## Future real-mode path

- Add Polkadot.js extension wallet connect.
- Prepare `balances.transferKeepAlive(dest, value)` with challenge amount.
- Submit only after user approval and wallet confirmation.
- Verify tx hash by indexing the inclusion block or querying events.
- Store real receipt alongside mock/local receipts.

## License

MIT
