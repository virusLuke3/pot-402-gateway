# 2-Minute Demo Script

**0:00 — Problem**
Portaldot builders need a simple way to charge for API calls, datasets, AI tools, or creator resources using native POT.

**0:20 — Solution**
POT-402 Gateway turns a downstream API into a Portaldot payment challenge. Instead of a subscription system, the API itself says: `402 Payment Required`.

**0:40 — Live demo: downstream AI report**
Click “Run Downstream AI Report Demo”. The downstream `AI Hackathon Report API` first returns a structured 402 challenge because the caller has not paid.

**1:00 — Payment proof**
The gateway previews and submits a native `balances.transferKeepAlive` transfer from Alice on the Portaldot local dev node. Show `verified_local_dev_chain`, tx hash, block hash, payer Alice, gateway recipient, and amount `0.0030 POT`.

**1:25 — Downstream verification**
Show that the downstream service accepts only `verified_local_dev_chain` receipts. Mock receipts are rejected, so this is not just a simulated paywall.

**1:40 — Unlock**
The `POT-402 Verified Hackathon Report` is returned. The report includes the idea, sponsor-fit notes, MVP path, risk, and next iteration.

**1:55 — Close**
POT-402 Gateway is a reusable payment primitive for Portaldot builders: downstream APIs can monetize per call using native POT receipts without handling wallets, billing, or subscriptions themselves.

## Fallback mock flow

If the local node is unavailable during recording, use “Simulate Portaldot Payment” and explicitly say it is the safe fallback. The preferred prize demo is the downstream local-dev transfer proof because the downstream verifier rejects mock receipts.
