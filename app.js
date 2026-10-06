const Core = window.TradingCore;
const STORE_KEY = 'alphabetPaperTrader.v1';
let state = loadState();

function loadState(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)) || Core.createInitialState(); } catch { return Core.createInitialState(); } }
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function money(v){ return Number(v).toLocaleString(undefined,{style:'currency',currency:'USD'}); }
function pct(v){ return `${Number(v).toFixed(2)}%`; }
function signedClass(v){ return Number(v) >= 0 ? 'good' : 'bad'; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3500); }

function metric(label, value, cls='') { return `<div class="metric"><span>${label}</span><strong class="${cls}">${value}</strong></div>`; }

function render(){
  const q = state.quotes[state.settings.primaryTicker];
  const primary = state.positions.GOOGL, secondary = state.positions.GOOG;
  const total = Core.portfolioValue(state), ret = Core.totalReturn(state), unreal = Core.unrealizedPL(state);
  document.getElementById('quoteStamp').textContent = `Quote: ${q.mode}, ${q.source}, ${new Date(q.timestamp).toLocaleString()}`;
  document.getElementById('metrics').innerHTML = [
    metric('Virtual cash', money(state.cash)), metric('Total portfolio value', money(total), signedClass(ret)),
    metric('Alphabet position value', money(Core.positionValue(state,'GOOGL') + Core.positionValue(state,'GOOG'))),
    metric('GOOGL shares held', primary.shares.toFixed(6)), metric('GOOG shares held', secondary.shares.toFixed(6)),
    metric('GOOGL avg purchase price', money(primary.averageCost)), metric('Latest GOOGL price', money(state.quotes.GOOGL.price)),
    metric('Unrealized P/L', money(unreal), signedClass(unreal)), metric('Realized P/L', money(state.realizedPL), signedClass(state.realizedPL)),
    metric('Total return USD', money(ret), signedClass(ret)), metric('Total return %', pct(Core.totalReturnPct(state)), signedClass(ret)),
    metric('Daily change', dailyChangeText('GOOGL'), state.quotes.GOOGL.price >= state.quotes.GOOGL.previousClose ? 'good':'bad')
  ].join('');
  document.querySelector('#quoteForm [name=price]').value = state.quotes.GOOGL.price;
  document.querySelector('#quoteForm [name=previousClose]').value = state.quotes.GOOGL.previousClose;
  syncOrderPrice(); renderTrades(); renderJournal(); renderAnalytics(); renderResearch(); drawChart(); save();
}
function dailyChangeText(symbol){ const q=state.quotes[symbol]; const diff=q.price-q.previousClose; return `${money(diff)} (${pct(q.previousClose ? diff/q.previousClose*100 : 0)})`; }
function syncOrderPrice(){ const form=document.getElementById('orderForm'); const sym=form.symbol.value; const qty=Number(form.quantity.value||0); const price=state.quotes[sym].price; form.priceView.value=money(price); document.getElementById('orderSummary').textContent=`SIMULATED ${form.side.value}: ${sym} × ${qty||0} at ${money(price)} = ${money(qty*price)}. Real money involved: $0.`; }
function renderTrades(){ const rows=state.trades.slice().reverse().map(t=>`<tr><td>${new Date(t.timestamp).toLocaleString()}</td><td>${t.ticker}</td><td>${t.side}</td><td>${t.quantity}</td><td>${money(t.price)}</td><td>${money(t.total)}</td><td>${money(t.cashAfter)}</td><td>${t.positionAfter}</td></tr>`).join(''); document.getElementById('tradeRows').innerHTML = rows || '<tr><td colspan="8">No simulated trades yet.</td></tr>'; }
function renderJournal(){ document.getElementById('journalRows').innerHTML = state.journal.slice().reverse().map(j=>`<article class="card entry"><h3>${j.stance} ${j.ticker} · ${j.confidence}/100</h3><p class="muted">${new Date(j.timestamp).toLocaleString()} at ${money(j.currentPrice)} · Horizon: ${j.horizon || 'Unavailable'}</p><p>${escapeHtml(j.thesis)}</p><p><strong>Upside:</strong> ${escapeHtml(j.expectedUpside || 'Unavailable')}<br><strong>Risk:</strong> ${escapeHtml(j.downsideRisk || 'Unavailable')}<br><strong>Invalidation:</strong> ${escapeHtml(j.invalidation || 'Unavailable')}</p></article>`).join('') || '<p class="muted">No journal entries yet.</p>'; }
function renderAnalytics(){ const a=Core.analytics(state), b=Core.benchmark(state); document.getElementById('analyticsMetrics').innerHTML=[metric('Trades',a.trades),metric('Closed trades',a.closedTrades),metric('Winning closed trades',a.wins),metric('Losing closed trades',a.losses),metric('Win rate',a.winRate===null?'Sample too small':pct(a.winRate)),metric('Average gain',a.averageGain===null?'Sample too small':money(a.averageGain)),metric('Average loss',a.averageLoss===null?'Sample too small':money(a.averageLoss)),metric('Realized P/L',money(a.realizedPL),signedClass(a.realizedPL)),metric('Unrealized P/L',money(a.unrealizedPL),signedClass(a.unrealizedPL)),metric('Total return',`${money(a.totalReturn)} / ${pct(a.totalReturnPct)}`,signedClass(a.totalReturn)),metric('Largest gain',a.largestGain===null?'Sample too small':money(a.largestGain)),metric('Largest loss',a.largestLoss===null?'Sample too small':money(a.largestLoss)),metric('Portfolio drawdown',pct(a.maxDrawdownPct)),metric('Trading frequency',a.tradingFrequency)].join(''); document.getElementById('benchmarkBox').innerHTML=[metric('Benchmark A — Cash',money(b.cashValue)),metric('Benchmark B — Buy and hold',money(b.buyHoldValue),signedClass(b.buyHoldReturn)),metric('Buy-hold return',`${money(b.buyHoldReturn)} / ${pct(b.buyHoldReturnPct)}`,signedClass(b.buyHoldReturn)),metric('Simulator vs buy-hold',`${money(b.differenceUSD)} / ${pct(b.differencePct)}`,signedClass(b.differenceUSD))].join(''); }
function renderResearch(){ const fields=[['Latest GOOGL price',money(state.quotes.GOOGL.price)],['Latest GOOG price',money(state.quotes.GOOG.price)],['Market capitalization','Unavailable'],['P/E','Unavailable'],['Revenue','Unavailable'],['Earnings','Unavailable'],['Free cash flow','Unavailable'],['Recent earnings date','Unavailable'],['Next known earnings date','Unavailable'],['Major AI developments','Unavailable'],['Google Cloud developments','Unavailable'],['Advertising developments','Unavailable'],['Regulatory risks','Unavailable'],['Major relevant news','Unavailable']]; document.getElementById('researchGrid').innerHTML=fields.map(([k,v])=>metric(k,v)).join(''); }
function drawChart(){ const c=document.getElementById('equityChart'), ctx=c.getContext('2d'), vals=state.equityHistory.map(e=>e.value); ctx.clearRect(0,0,c.width,c.height); ctx.strokeStyle='#2a3b4f'; ctx.lineWidth=1; for(let i=0;i<5;i++){let y=30+i*60;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(c.width-20,y);ctx.stroke();} if(vals.length<2){ctx.fillStyle='#9fb0c3';ctx.fillText('Equity history appears after quote updates or simulated trades.',50,160);return;} const min=Math.min(...vals), max=Math.max(...vals), spread=max-min||1; ctx.strokeStyle='#4fb3a3'; ctx.lineWidth=3; ctx.beginPath(); vals.forEach((v,i)=>{const x=45+(i/(vals.length-1))*(c.width-75); const y=285-((v-min)/spread)*235; i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.stroke(); ctx.fillStyle='#eef5fb'; ctx.fillText(`${money(max)} high`,50,24); ctx.fillText(`${money(min)} low`,50,305); }
function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('is-active')); document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active-panel')); btn.classList.add('is-active'); document.getElementById(btn.dataset.target).classList.add('active-panel'); }));
document.getElementById('quoteForm').addEventListener('submit',e=>{ e.preventDefault(); try{ const f=e.currentTarget; state=Core.updateQuote(state,f.symbol.value,Number(f.price.value),Number(f.previousClose.value),'Manual/demo'); toast('Simulated quote updated.'); render(); }catch(err){toast(err.message);} });
document.querySelector('#quoteForm [name=symbol]').addEventListener('change', e=>{ const q=state.quotes[e.target.value]; e.currentTarget.form.price.value=q.price; e.currentTarget.form.previousClose.value=q.previousClose; });
document.getElementById('orderForm').addEventListener('input',syncOrderPrice);
document.getElementById('orderForm').addEventListener('submit',e=>{ e.preventDefault(); const f=e.currentTarget; try{ const order={symbol:f.symbol.value,side:f.side.value,quantity:Number(f.quantity.value),note:f.note.value,hermesReasoning:f.hermesReasoning.value}; const checked=Core.validateOrder(state,order); const ok=confirm(`SIMULATED ${checked.side}\nTicker: ${checked.symbol}\nShares: ${checked.quantity}\nReference price: ${money(checked.price)}\nEstimated value: ${money(checked.gross)}\nReal money involved: $0`); if(!ok)return; state=Core.applyOrder(state,order); f.reset(); toast('Simulated order recorded.'); render(); }catch(err){toast(err.message);} });
document.getElementById('journalForm').addEventListener('submit',e=>{ e.preventDefault(); const f=e.currentTarget; try{ state=Core.addJournalEntry(state,Object.fromEntries(new FormData(f).entries())); f.reset(); toast('Journal entry saved.'); render(); }catch(err){toast(err.message);} });
document.getElementById('resetBtn').addEventListener('click',()=>{ if(confirm('Reset this browser simulation?')){ state=Core.createInitialState(); localStorage.setItem(STORE_KEY,JSON.stringify(state)); render(); toast('Simulator reset.'); } });
render();
