# Architecture

The simulator is intentionally static and local-first.

- `app/index.html` defines accessible navigation, dashboard sections, forms, tables, and canvas chart.
- `app/styles.css` contains the responsive dark-mode friendly design system.
- `app/core.js` contains pure accounting and analytics functions. It supports browser globals and Node tests.
- `app/app.js` handles DOM state, localStorage persistence, rendering, and user interactions.
- `tests/accounting.test.js` validates portfolio accounting and rejection rules with Node's built-in `assert`.

Data is persisted in `localStorage` under `alphabetPaperTrader.v1`. No secrets or brokerage credentials are requested or stored.
