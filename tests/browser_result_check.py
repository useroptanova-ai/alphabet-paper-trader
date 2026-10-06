import os
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('SIMULATOR_URL', 'http://127.0.0.1:8766/')
STORE = 'alphabetPaperTrader.v1'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.evaluate("key => localStorage.removeItem(key)", STORE)
    page.reload()
    page.wait_for_load_state('networkidle')

    # Build a deterministic account independently of the UI controls:
    # Buy 10 GOOGL @ 100, mark to 120, then sell 4 @ 120.
    state = page.evaluate("""
    () => {
      let s = TradingCore.createInitialState(10000, 100);
      s = TradingCore.updateQuote(s, 'GOOGL', 100, 98, 'Test quote');
      s = TradingCore.applyOrder(s, {symbol:'GOOGL', side:'BUY', quantity:10}, '2026-01-01T00:00:00Z');
      s = TradingCore.updateQuote(s, 'GOOGL', 120, 100, 'Test quote');
      s = TradingCore.applyOrder(s, {symbol:'GOOGL', side:'SELL', quantity:4}, '2026-01-02T00:00:00Z');
      localStorage.setItem('alphabetPaperTrader.v1', JSON.stringify(s));
      return s;
    }
    """)
    page.reload()
    page.wait_for_load_state('networkidle')
    body = page.locator('body')

    # Independently expected results:
    # cash: 10000 - 1000 + 480 = 9480
    # remaining shares: 6, avg cost: 100, current price: 120
    # position value: 720; total equity: 10200
    # realized P/L: 4 * (120 - 100) = 80
    # unrealized P/L: 6 * (120 - 100) = 120
    # total return: 200 / 10000 = 2%
    expect(body).to_contain_text('$9,480.00')
    expect(body).to_contain_text('$10,200.00')
    expect(body).to_contain_text('6.000000')
    expect(body).to_contain_text('$100.00')
    expect(body).to_contain_text('$120.00')
    expect(body).to_contain_text('$80.00')
    expect(body).to_contain_text('$120.00')
    expect(body).to_contain_text('$200.00')
    expect(body).to_contain_text('2.00%')

    # Regression: sub-cent orders must not become free simulated shares.
    page.get_by_role('button', name='Trade').click()
    page.locator('#orderForm [name="quantity"]').fill('0.000001')
    page.get_by_role('button', name='Confirm simulation').click()
    expect(page.locator('#toast')).to_contain_text('at least $0.01')
    stored = page.evaluate("JSON.parse(localStorage.getItem('alphabetPaperTrader.v1')).positions.GOOGL.shares")
    assert stored == 6, f'tiny invalid order changed shares to {stored}'

    browser.close()
    print('browser result checks passed')
