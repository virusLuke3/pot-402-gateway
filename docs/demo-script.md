# 2-Minute Demo Script

**0:00 — Problem**
Portaldot builders need a simple way to charge for API calls, datasets, tools, or creator resources using native POT.

**0:20 — Solution**
POT-402 Gateway turns a protected API into a Portaldot payment challenge. Instead of a subscription system, the API itself says: `402 Payment Required`.

**0:40 — Live demo: one-click local proof**
Click “Run Full Local Dev Demo”. The app creates a structured 402 challenge, previews the native `balances.transferKeepAlive` call, submits it to the local Portaldot dev node, verifies the receipt, and unlocks the paid API.

**1:10 — Payment proof**
Show the local receipt: `verified_local_dev_chain`, tx hash, block hash, payer Alice, gateway recipient, amount in planck, and safety note that no mainnet funds were touched.

**1:35 — Unlock**
Click “Unlock Premium Response”. The paid API now returns premium data and a proof ledger entry with `verified_local_dev_chain` status.

**1:50 — Native fit**
This is built for Portaldot’s Substrate-native environment, not EVM. The V1 primitive can become a builder marketplace for paid APIs, creator passes, and tool monetization.

**1:58 — Close**
POT-402 Gateway is a reusable payment primitive for Portaldot builders: runnable MVP, clear demo, native POT flow, and a realistic ecosystem use case.

## Fallback mock flow

If the local node is unavailable during recording, use “Simulate Portaldot Payment” and explicitly say it is the safe fallback. The preferred prize demo is the local-dev transfer proof.
