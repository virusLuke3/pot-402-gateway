# POT-402 Gateway Architecture

```mermaid
sequenceDiagram
    participant Judge
    participant Web as Demo Web UI
    participant API as POT-402 Gateway API
    participant Ledger as Receipt Ledger
    participant Portaldot as Portaldot RPC / POT transfer

    Judge->>Web: Click "Call Protected API"
    Web->>API: GET /api/protected/weather
    API-->>Web: 402 Payment Required + challenge
    Web->>API: POST /api/receipts/simulate (safe mode)
    API->>Ledger: Store mock receipt + access token
    API-->>Web: receipt + access token
    Web->>API: GET /api/protected/weather?accessToken=...
    API->>Ledger: Verify access token
    API-->>Web: Premium API response

    Note over Web,Portaldot: Real mode replaces simulation with approved Polkadot.js / Portaldot transferKeepAlive tx.
```

## Boundary

- Safe mode demonstrates the complete gateway state machine without chain broadcast.
- Read-only chain endpoints can inspect Portaldot RPC.
- Real payment mode requires explicit approval before any Portaldot transaction.
