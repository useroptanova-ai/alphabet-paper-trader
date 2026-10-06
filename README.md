# Alphabet Paper-Trading Simulator

A local-first paper-trading simulator for Alphabet shares (`GOOGL` and `GOOG`). It never connects to a broker and never places real orders. All trades are simulated and stored in the browser's local storage.

## Launch locally

```bash
cd /home/jebberhd/alphabet-paper-trader
python3 -m http.server 8080 --directory app
```

Open http://localhost:8080

## Features

- Configurable starting virtual cash, default USD 10,000.
- Manual/demo market price mode with explicit quote timestamp and source.
- Simulated buy and sell order ticket with confirmation and validation.
- Local persistent portfolio, trade ledger, journal, and equity history.
- Cash, position, average-cost, realized P/L, unrealized P/L, total return, and benchmark calculations.
- Buy-and-hold Alphabet benchmark from the simulator start date.
- Hermes decision journal for BUY/HOLD/SELL/WATCH hypotheses.
- Analytics panel with trade counts, realized/unrealized P/L, win rate when meaningful, and drawdown.
- Safety banner and repeated no-real-money disclosures.

## Market data

Version 1 ships in safe manual/demo-price mode so no API keys are exposed in the browser. A future local backend can proxy a paid or free market-data provider using environment variables. Missing fundamentals are shown as `Unavailable` rather than fabricated.

## Tests

```bash
cd /home/jebberhd/alphabet-paper-trader
node tests/accounting.test.js
```

## Safety boundaries

No brokerage integration, no live orders, no banking, no real-money transactions, and no storage of brokerage credentials.
