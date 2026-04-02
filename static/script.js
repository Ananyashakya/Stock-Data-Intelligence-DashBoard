let currentSymbol = null;
let currentName   = null;
let currentDays   = 30;
let chartInst     = null;
let tickerData    = [];

// ── Boot ──────────────────────────────────────────────────

window.onload = function () {
    loadCompanies();
    loadGainersLosers();
    bindTimeFilters();
    bindModal();
};

// ── Companies ─────────────────────────────────────────────

async function loadCompanies() {
    try {
        const res  = await fetch('/companies');
        const list = await res.json();
        const nav  = document.getElementById('company-list');
        nav.innerHTML = '';

        list.forEach((c, i) => {
            const btn = document.createElement('button');
            btn.className   = 'cbtn';
            btn.dataset.sym = c.symbol;
            btn.style.animationDelay = `${i * 0.04}s`;
            btn.innerHTML = `
                <span class="cbtn-name">${c.name}</span>
                <span class="cbtn-sym">${c.symbol.replace('.NS','')}</span>
            `;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cbtn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadStock(c.symbol, c.name, currentDays);
            });
            nav.appendChild(btn);
        });
    } catch (e) {
        console.error('loadCompanies:', e);
    }
}

// ── Gainers / Losers + Ticker ─────────────────────────────

async function loadGainersLosers() {
    const box = document.getElementById('gainers-losers');
    try {
        const res  = await fetch('/gainers_losers');
        const data = await res.json();
        box.innerHTML = '';

        const makeRow = (item, up) => `
            <div class="gl-row">
                <span class="gl-name">${item.name.split(' ')[0]}</span>
                <span class="gl-pct ${up ? 'up' : 'dn'}">${up ? '+' : ''}${item.change_pct.toFixed(2)}%</span>
            </div>`;

        box.innerHTML += '<div class="gl-head">Gainers</div>';
        data.gainers.forEach(g => { box.innerHTML += makeRow(g, true); });
        box.innerHTML += '<div class="gl-head">Losers</div>';
        data.losers.forEach(l  => { box.innerHTML += makeRow(l, false); });

        // build ticker from gainers+losers
        tickerData = [...data.gainers, ...data.losers];
        buildTicker(tickerData);

    } catch (e) {
        box.innerHTML = '<div class="gl-loading">Unavailable</div>';
        buildTicker([]);
    }
}

function buildTicker(items) {
    const track = document.getElementById('ticker-track');
    if (!items.length) { track.innerHTML = ''; return; }

    // double the items so the scroll looks seamless
    const all = [...items, ...items];
    track.innerHTML = all.map(item => {
        const up   = item.change_pct >= 0;
        const sign = up ? '+' : '';
        return `
            <span class="ticker-item">
                <span class="ticker-sym">${item.symbol.replace('.NS','')}</span>
                <span class="ticker-price">Rs.${item.latest_close.toFixed(2)}</span>
                <span class="ticker-chg ${up ? 'up' : 'dn'}">${sign}${item.change_pct.toFixed(2)}%</span>
            </span>`;
    }).join('');
}

// ── Stock Load ────────────────────────────────────────────

async function loadStock(symbol, name, days) {
    currentSymbol = symbol;
    currentName   = name;
    currentDays   = days;

    // sync time filter buttons
    const tfGroup = document.getElementById('tf-group');
    tfGroup.style.opacity      = '1';
    tfGroup.style.pointerEvents = 'auto';
    document.querySelectorAll('.tf').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.days) === days)
    );

    try {
        const [dataRes, sumRes] = await Promise.all([
            fetch(`/data/${symbol}?days=${days}`),
            fetch(`/summary/${symbol}`)
        ]);

        let data = await dataRes.json();
        const sum = await sumRes.json();

        if (data.error) { console.error(data.error); return; }
        data.sort((a, b) => new Date(a.date) - new Date(b.date));

        const last = data[data.length - 1];
        const prev = data[data.length - 2];
        const dayChange    = prev ? last.close - prev.close : 0;
        const dayChangePct = prev ? (dayChange / prev.close) * 100 : 0;
        const isUp = dayChange >= 0;

        // update topbar
        document.getElementById('stock-title').innerHTML = `
            <span class="stock-name">${name}</span>
            <span class="stock-sym">${symbol}</span>
            <span class="stock-price">Rs.${last.close.toFixed(2)}</span>
            <span class="stock-chg ${isUp ? 'up' : 'dn'}">${isUp ? '+' : ''}${dayChangePct.toFixed(2)}%</span>
        `;

        // chart meta row
        document.getElementById('chart-meta').innerHTML = `
            <span class="cmeta-item"><span class="cmeta-label">OPEN </span><span class="cmeta-val">Rs.${last.open.toFixed(2)}</span></span>
            <div class="cmeta-sep"></div>
            <span class="cmeta-item"><span class="cmeta-label">HIGH </span><span class="cmeta-val up">Rs.${last.high.toFixed(2)}</span></span>
            <div class="cmeta-sep"></div>
            <span class="cmeta-item"><span class="cmeta-label">LOW </span><span class="cmeta-val dn">Rs.${last.low.toFixed(2)}</span></span>
            <div class="cmeta-sep"></div>
            <span class="cmeta-item"><span class="cmeta-label">VOL </span><span class="cmeta-val">${(last.volume/1e6).toFixed(2)}M</span></span>
        `;

        showChart();
        renderChart(data);
        renderStatStrip(data, last, prev, dayChange, dayChangePct, isUp);
        renderPanel(sum, last);

    } catch (e) {
        console.error('loadStock:', e);
    }
}

function showChart() {
    document.getElementById('chart-idle').style.display = 'none';
    const live = document.getElementById('chart-live');
    live.style.display  = 'flex';
    live.style.flexDirection = 'column';
    live.style.height   = '100%';
    live.style.gap      = '10px';
}

// ── Chart ─────────────────────────────────────────────────

function renderChart(data) {
    const ctx = document.getElementById('priceChart');
    if (chartInst) chartInst.destroy();

    const closes = data.map(d => d.close);
    const ma7    = data.map(d => d.ma_7);
    const labels = data.map(d => d.date);

    // gradient fill
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0,   'rgba(0,168,90,0.15)');
    gradient.addColorStop(0.6, 'rgba(0,168,90,0.03)');
    gradient.addColorStop(1,   'rgba(0,168,90,0)');

    chartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Close Price',
                    data: closes,
                    borderColor: '#00a85a',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#00a85a',
                    tension: 0.35,
                    fill: true
                },
                {
                    label: '7-Day MA',
                    data: ma7,
                    borderColor: '#c48a1a',
                    borderDash: [4, 3],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.35
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        font: { family: "'Inter'", size: 11 },
                        color: '#4a5550',
                        usePointStyle: true,
                        pointStyleWidth: 12,
                        boxHeight: 5,
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: '#ffffff',
                    borderColor: '#c8cec9',
                    borderWidth: 1,
                    titleFont: { family: "'Inter'", size: 10 },
                    bodyFont:  { family: "'Inter'", size: 12 },
                    titleColor: '#8a9490',
                    bodyColor:  '#141715',
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: items => items[0].label,
                        label: ctx => `${ctx.dataset.label === 'Close Price' ? 'Close' : '7D MA'}: Rs.${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid:  { color: '#e8ebe9' },
                    ticks: {
                        maxTicksLimit: 7,
                        font: { family: "'Inter'", size: 10 },
                        color: '#8a9490'
                    }
                },
                y: {
                    position: 'right',
                    grid:  { color: '#e8ebe9' },
                    ticks: {
                        font: { family: "'Inter'", size: 10 },
                        color: '#8a9490',
                        callback: v => `${v.toFixed(0)}`
                    }
                }
            }
        }
    });
}

// ── Stat Strip ────────────────────────────────────────────

function renderStatStrip(data, last, prev, dayChange, dayChangePct, isUp) {
    const avgVol = data.reduce((s, d) => s + d.volume, 0) / data.length;
    const strip  = document.getElementById('stat-strip');

    strip.innerHTML = `
        <div class="sc">
            <div class="sc-label">Last Close</div>
            <div class="sc-val">Rs.${last.close.toFixed(2)}</div>
            <div class="sc-sub">${last.date}</div>
        </div>
        <div class="sc">
            <div class="sc-label">Day Change</div>
            <div class="sc-val ${isUp ? 'up' : 'dn'}">${isUp ? '+' : ''}${dayChangePct.toFixed(2)}%</div>
            <div class="sc-sub">${isUp ? '+' : ''}Rs.${dayChange.toFixed(2)}</div>
        </div>
        <div class="sc">
            <div class="sc-label">Daily Return</div>
            <div class="sc-val ${last.daily_return >= 0 ? 'up' : 'dn'}">${(last.daily_return * 100).toFixed(2)}%</div>
            <div class="sc-sub">(close − open) / open</div>
        </div>
        <div class="sc">
            <div class="sc-label">Avg Volume</div>
            <div class="sc-val">${(avgVol/1e6).toFixed(2)}M</div>
            <div class="sc-sub">over ${data.length} sessions</div>
        </div>
    `;
}

// ── Panel ─────────────────────────────────────────────────

function renderPanel(s, last) {
    document.getElementById('panel-idle').style.display    = 'none';
    document.getElementById('panel-content').style.display = 'block';

    document.getElementById('v-high').textContent = `Rs.${s.week_52_high.toFixed(2)}`;
    document.getElementById('v-low').textContent  = `Rs.${s.week_52_low.toFixed(2)}`;
    document.getElementById('v-avg').textContent  = `Rs.${s.avg_close.toFixed(2)}`;
    document.getElementById('v-vol').textContent  = `${(s.volatility * 100).toFixed(2)}%`;

    // 52W range bar — show where avg close sits
    const lo  = s.week_52_low;
    const hi  = s.week_52_high;
    const cur = last ? last.close : s.avg_close;
    const pct = Math.max(0, Math.min(100, ((cur - lo) / (hi - lo)) * 100));
    document.getElementById('range-fill').style.width  = `${pct}%`;
    document.getElementById('range-thumb').style.left  = `${pct}%`;

    // RSI
    const rsi     = s.rsi || 0;
    const isOS    = rsi < 30;
    const isOB    = rsi > 70;
    const rsiBadgeClass = isOS ? 'oversold' : isOB ? 'overbought' : 'neutral';
    const rsiBadgeTxt   = isOS ? 'Oversold'  : isOB ? 'Overbought' : 'Neutral';
    const rsiColor = isOS ? '#00a85a' : isOB ? '#d93250' : '#1a7fd4';

    document.getElementById('v-rsi').textContent     = rsi.toFixed(1);
    document.getElementById('v-rsi').style.color     = rsiColor;
    document.getElementById('rsi-badge').textContent  = rsiBadgeTxt;
    document.getElementById('rsi-badge').className    = `rsi-badge ${rsiBadgeClass}`;
    document.getElementById('rsi-fill').style.width   = `${Math.min(rsi, 100)}%`;
    document.getElementById('rsi-fill').style.background = rsiColor;

    // prediction
    const predCard = document.getElementById('pred-card');
    if (s.predicted_next_close) {
        const isUp = s.predicted_next_close > (last ? last.close : s.avg_close);
        document.getElementById('v-pred').textContent  = `Rs.${s.predicted_next_close}`;
        document.getElementById('pred-sub').textContent = `Linear trend — ${isUp ? 'upward bias' : 'downward bias'}`;
        predCard.style.display = 'block';
    } else {
        predCard.style.display = 'none';
    }
}

// ── Time Filters ──────────────────────────────────────────

function bindTimeFilters() {
    document.querySelectorAll('.tf[data-days]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!currentSymbol) return;
            loadStock(currentSymbol, currentName, parseInt(btn.dataset.days));
        });
    });
}

// ── Modal ─────────────────────────────────────────────────

function bindModal() {
    document.getElementById('compare-btn').addEventListener('click', openModal);
    document.getElementById('modal-x').addEventListener('click', closeModal);
    document.getElementById('modal-go').addEventListener('click', runCompare);
    document.getElementById('modal-bg').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-bg')) closeModal();
    });
    document.getElementById('compare-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') runCompare();
    });
}

function openModal() {
    if (!currentSymbol) return;
    document.getElementById('modal-chip').textContent     = `${currentName} (${currentSymbol})`;
    document.getElementById('compare-input').value        = '';
    document.getElementById('compare-result').innerHTML   = '';
    document.getElementById('modal-bg').classList.add('open');
    setTimeout(() => document.getElementById('compare-input').focus(), 100);
}

function closeModal() {
    document.getElementById('modal-bg').classList.remove('open');
}

async function runCompare() {
    const sym2 = document.getElementById('compare-input').value.trim().toUpperCase();
    const out  = document.getElementById('compare-result');
    if (!sym2 || !currentSymbol) return;

    out.innerHTML = '<div style="padding:0 20px 14px;font-family:var(--mono);font-size:11px;color:var(--faint)">Running comparison...</div>';

    try {
        const res  = await fetch(`/compare?symbol1=${currentSymbol}&symbol2=${sym2}`);
        const data = await res.json();

        if (!data.stock1 || !data.stock2) {
            out.innerHTML = `<div class="cmp-msg" style="padding:0 20px 16px">Could not find one or both symbols.</div>`;
            return;
        }

        const s1 = data.stock1;
        const s2 = data.stock2;
        const r1 = s1.avg_daily_return_pct !== undefined ? s1.avg_daily_return_pct : s1.avg_close;
        const r2 = s2.avg_daily_return_pct !== undefined ? s2.avg_daily_return_pct : s2.avg_close;
        const s1wins = r1 > r2;

        const col = (s, wins) => {
            const hasRet = s.avg_daily_return_pct !== undefined;
            return `
                <div class="cmp-col ${wins ? 'winner' : ''}">
                    <div class="cmp-head">
                        <div class="cmp-sym-label">${s.symbol}</div>
                        <div class="cmp-sym-name">${s.name || s.symbol}</div>
                    </div>
                    <div class="cmp-row"><span class="cmp-row-lbl">Avg Close</span><span class="cmp-row-val">Rs.${s.avg_close.toFixed(2)}</span></div>
                    <div class="cmp-row"><span class="cmp-row-lbl">52W High</span><span class="cmp-row-val">Rs.${s.week_52_high.toFixed(2)}</span></div>
                    <div class="cmp-row"><span class="cmp-row-lbl">52W Low</span><span class="cmp-row-val">Rs.${s.week_52_low.toFixed(2)}</span></div>
                    <div class="cmp-row"><span class="cmp-row-lbl">Volatility</span><span class="cmp-row-val">${(s.volatility*100).toFixed(2)}%</span></div>
                    ${hasRet ? `<div class="cmp-row"><span class="cmp-row-lbl">Avg Return</span><span class="cmp-row-val">${s.avg_daily_return_pct.toFixed(3)}%</span></div>` : ''}
                    <div class="cmp-row"><span class="cmp-row-lbl">RSI</span><span class="cmp-row-val">${s.rsi.toFixed(1)}</span></div>
                    ${wins ? '<div class="winner-tag">Better Performance</div>' : ''}
                </div>`;
        };

        out.innerHTML = `<div class="cmp-grid">${col(s1, s1wins)}${col(s2, !s1wins)}</div>`;

    } catch (e) {
        out.innerHTML = `<div class="cmp-msg" style="padding:0 20px 16px">Request failed. Check the symbol and try again.</div>`;
    }
}