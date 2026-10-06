(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TradingCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_CASH = 10000;
  const SYMBOLS = ['GOOGL', 'GOOG'];

  function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  function roundShares(value) { return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000; }
  function uid(prefix='tx') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

  function createInitialState(startingCash = DEFAULT_CASH, startPrice = 180) {
    return {
      version: 1,
      settings: { startingCash: roundMoney(startingCash), currency: 'USD', primaryTicker: 'GOOGL', secondaryTicker: 'GOOG' },
      cash: roundMoney(startingCash),
      positions: { GOOGL: { shares: 0, averageCost: 0 }, GOOG: { shares: 0, averageCost: 0 } },
      realizedPL: 0,
      trades: [],
      journal: [],
      quotes: {
        GOOGL: { price: startPrice, previousClose: startPrice * 0.99, timestamp: new Date().toISOString(), source: 'Manual/demo', mode: 'Manual price' },
        GOOG: { price: startPrice * 0.995, previousClose: startPrice * 0.985, timestamp: new Date().toISOString(), source: 'Manual/demo', mode: 'Manual price' }
      },
      benchmark: { startDate: new Date().toISOString(), symbol: 'GOOGL', startPrice },
      equityHistory: [{ timestamp: new Date().toISOString(), value: roundMoney(startingCash) }]
    };
  }

  function getPosition(state, symbol) {
    if (!SYMBOLS.includes(symbol)) throw new Error('Unsupported ticker');
    return state.positions[symbol] || { shares: 0, averageCost: 0 };
  }

  function quoteFor(state, symbol) {
    const q = state.quotes[symbol];
    if (!q || !Number.isFinite(Number(q.price)) || Number(q.price) <= 0) throw new Error('Valid reference price required');
    return { ...q, price: Number(q.price) };
  }

  function portfolioValue(state) {
    return roundMoney(Object.keys(state.positions).reduce((total, symbol) => {
      const p = state.positions[symbol];
      const price = state.quotes[symbol]?.price || 0;
      return total + (p.shares * price);
    }, state.cash));
  }

  function positionValue(state, symbol) {
    const p = getPosition(state, symbol);
    return roundMoney(p.shares * (state.quotes[symbol]?.price || 0));
  }

  function unrealizedPL(state) {
    return roundMoney(Object.keys(state.positions).reduce((total, symbol) => {
      const p = state.positions[symbol];
      const price = state.quotes[symbol]?.price || 0;
      return total + p.shares * (price - p.averageCost);
    }, 0));
  }

  function totalReturn(state) { return roundMoney(portfolioValue(state) - state.settings.startingCash); }
  function totalReturnPct(state) { return state.settings.startingCash ? roundMoney((totalReturn(state) / state.settings.startingCash) * 100) : 0; }

  function validateOrder(state, order) {
    const symbol = String(order.symbol || '').toUpperCase();
    const side = String(order.side || '').toUpperCase();
    const quantity = Number(order.quantity);
    if (!SYMBOLS.includes(symbol)) throw new Error('Ticker must be GOOGL or GOOG');
    if (!['BUY', 'SELL'].includes(side)) throw new Error('Side must be BUY or SELL');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero');
    const quote = quoteFor(state, symbol);
    const gross = roundMoney(quantity * quote.price);
    if (side === 'BUY' && gross > state.cash + 0.0001) throw new Error('Insufficient virtual cash');
    if (side === 'SELL' && quantity > getPosition(state, symbol).shares + 0.000001) throw new Error('Cannot sell more shares than the simulated position');
    return { symbol, side, quantity: roundShares(quantity), price: quote.price, gross };
  }

  function applyOrder(state, order, now = new Date().toISOString()) {
    const checked = validateOrder(state, order);
    const next = JSON.parse(JSON.stringify(state));
    const pos = getPosition(next, checked.symbol);
    let realizedDelta = 0;
    if (checked.side === 'BUY') {
      const oldCost = pos.shares * pos.averageCost;
      const newShares = roundShares(pos.shares + checked.quantity);
      pos.averageCost = newShares ? roundMoney((oldCost + checked.gross) / newShares) : 0;
      pos.shares = newShares;
      next.cash = roundMoney(next.cash - checked.gross);
    } else {
      realizedDelta = roundMoney((checked.price - pos.averageCost) * checked.quantity);
      pos.shares = roundShares(pos.shares - checked.quantity);
      if (pos.shares === 0) pos.averageCost = 0;
      next.cash = roundMoney(next.cash + checked.gross);
      next.realizedPL = roundMoney(next.realizedPL + realizedDelta);
    }
    const tx = {
      id: uid('tx'), timestamp: now, ticker: checked.symbol, side: checked.side, quantity: checked.quantity,
      price: checked.price, total: checked.gross, cashAfter: next.cash, positionAfter: pos.shares,
      realizedPL: realizedDelta, note: order.note || '', hermesReasoning: order.hermesReasoning || '', quoteTimestamp: next.quotes[checked.symbol].timestamp
    };
    next.trades.push(tx);
    next.equityHistory.push({ timestamp: now, value: portfolioValue(next) });
    return next;
  }

  function updateQuote(state, symbol, price, previousClose, source='Manual/demo') {
    if (!SYMBOLS.includes(symbol)) throw new Error('Unsupported ticker');
    const numeric = Number(price);
    if (!Number.isFinite(numeric) || numeric <= 0) throw new Error('Price must be greater than zero');
    const next = JSON.parse(JSON.stringify(state));
    next.quotes[symbol] = { price: roundMoney(numeric), previousClose: roundMoney(previousClose || next.quotes[symbol]?.previousClose || numeric), timestamp: new Date().toISOString(), source, mode: 'Manual price' };
    next.equityHistory.push({ timestamp: new Date().toISOString(), value: portfolioValue(next) });
    return next;
  }

  function addJournalEntry(state, entry, now = new Date().toISOString()) {
    const symbol = String(entry.symbol || '').toUpperCase();
    if (!SYMBOLS.includes(symbol)) throw new Error('Ticker must be GOOGL or GOOG');
    const confidence = Number(entry.confidence);
    const next = JSON.parse(JSON.stringify(state));
    next.journal.push({
      id: uid('jrnl'), timestamp: now, ticker: symbol, currentPrice: quoteFor(state, symbol).price,
      stance: entry.stance || 'WATCH', thesis: entry.thesis || '', horizon: entry.horizon || '', expectedUpside: entry.expectedUpside || '',
      downsideRisk: entry.downsideRisk || '', confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 50,
      invalidation: entry.invalidation || ''
    });
    return next;
  }

  function benchmark(state) {
    const startPrice = Number(state.benchmark.startPrice || state.quotes.GOOGL.price);
    const current = Number(state.quotes[state.benchmark.symbol]?.price || startPrice);
    const shares = state.settings.startingCash / startPrice;
    const value = roundMoney(shares * current);
    const diff = roundMoney(portfolioValue(state) - value);
    return { cashValue: state.settings.startingCash, buyHoldValue: value, buyHoldReturn: roundMoney(value - state.settings.startingCash), buyHoldReturnPct: roundMoney(((value - state.settings.startingCash) / state.settings.startingCash) * 100), differenceUSD: diff, differencePct: roundMoney(totalReturnPct(state) - (((value - state.settings.startingCash) / state.settings.startingCash) * 100)) };
  }

  function analytics(state) {
    const sells = state.trades.filter(t => t.side === 'SELL');
    const wins = sells.filter(t => t.realizedPL > 0);
    const losses = sells.filter(t => t.realizedPL < 0);
    const values = state.equityHistory.map(e => e.value);
    let peak = values[0] || state.settings.startingCash, maxDrawdown = 0;
    values.forEach(v => { peak = Math.max(peak, v); maxDrawdown = Math.min(maxDrawdown, peak ? ((v - peak) / peak) * 100 : 0); });
    return {
      trades: state.trades.length, closedTrades: sells.length, wins: wins.length, losses: losses.length,
      winRate: sells.length ? roundMoney((wins.length / sells.length) * 100) : null,
      averageGain: wins.length ? roundMoney(wins.reduce((s,t)=>s+t.realizedPL,0)/wins.length) : null,
      averageLoss: losses.length ? roundMoney(losses.reduce((s,t)=>s+t.realizedPL,0)/losses.length) : null,
      realizedPL: roundMoney(state.realizedPL), unrealizedPL: unrealizedPL(state), totalReturn: totalReturn(state), totalReturnPct: totalReturnPct(state),
      largestGain: wins.length ? Math.max(...wins.map(t=>t.realizedPL)) : null, largestLoss: losses.length ? Math.min(...losses.map(t=>t.realizedPL)) : null,
      maxDrawdownPct: roundMoney(maxDrawdown), tradingFrequency: state.trades.length < 2 ? 'Sample too small' : `${state.trades.length} trades recorded`
    };
  }

  return { DEFAULT_CASH, SYMBOLS, createInitialState, applyOrder, validateOrder, updateQuote, addJournalEntry, portfolioValue, positionValue, unrealizedPL, totalReturn, totalReturnPct, benchmark, analytics, roundMoney };
});
