// 글 안의 증시 자금동향 데이터(<script type="application/json" class="liquidity-data">)로
// 투자자예탁금, 신용거래융자 잔고, 반대매매 그래프 3개를 그린다. 외부 라이브러리 없이 SVG 로 그린다.
(function () {
  const CONTAINER_SELECTOR = ".liquidity-charts";
  const DATA_SELECTOR = "script.liquidity-data";
  const TRILLION = 1e12;
  const HUNDRED_MILLION = 1e8;
  const WIDTH = 520;
  const HEIGHT = 230;
  const PAD = { top: 26, right: 54, bottom: 26, left: 44 };
  const MAX_BAR_WIDTH = 24;
  const MIN_BAR_WIDTH = 2;
  const BAR_GAP = 2;
  const BAR_RADIUS = 4;
  const TICK_COUNT = 4;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SERIES_1 = "var(--viz-series-1)";
  const SERIES_2 = "var(--viz-series-2)";

  function createSvgElement(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.appendChild(node);
    return node;
  }

  function buildNiceTicks(min, max) {
    const span = max - min || 1;
    const roughStep = span / TICK_COUNT;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const ratio = roughStep / magnitude;
    const step = magnitude * (ratio >= 7.5 ? 10 : ratio >= 3.5 ? 5 : ratio >= 1.5 ? 2 : 1);
    const ticks = [];
    for (let value = Math.floor(min / step) * step; value <= max + step * 0.001; value += step) ticks.push(+value.toFixed(6));
    if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }

  function formatShortDate(isoDate) {
    return `${+isoDate.slice(5, 7)}/${+isoDate.slice(8, 10)}`;
  }

  function formatValue(value, unit, digits) {
    if (value == null) return "-";
    return `${value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit}`;
  }

  function lastValue(values) {
    return values.filter((value) => value != null).at(-1);
  }

  function drawFrame(svg, dates, ticks, unit) {
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const x = (i) => PAD.left + (dates.length === 1 ? plotWidth / 2 : (i / (dates.length - 1)) * plotWidth);
    const y = (value) => PAD.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

    ticks.forEach((tick) => {
      createSvgElement("line", { x1: PAD.left, x2: WIDTH - PAD.right, y1: y(tick), y2: y(tick), class: "viz-grid" }, svg);
      createSvgElement("text", { x: PAD.left - 8, y: y(tick) + 4, "text-anchor": "end" }, svg).textContent = tick.toLocaleString("ko-KR");
    });
    dates.forEach((date, i) => {
      if (i !== 0 && date.slice(5, 7) === dates[i - 1].slice(5, 7)) return;
      createSvgElement("text", { x: x(i), y: HEIGHT - 6, "text-anchor": i === 0 ? "start" : "middle" }, svg).textContent = formatShortDate(date);
    });
    createSvgElement("text", { x: PAD.left - 8, y: 10, "text-anchor": "end" }, svg).textContent = `(${unit})`;
    return { x, y };
  }

  function attachHover({ card, svg, dates, x, describe }) {
    const tip = document.createElement("div");
    tip.className = "viz-tip";
    card.appendChild(tip);
    const cursor = createSvgElement("line", { y1: PAD.top, y2: HEIGHT - PAD.bottom, class: "viz-cursor", visibility: "hidden" }, svg);
    const hitArea = createSvgElement("rect", { x: PAD.left, y: 0, width: WIDTH - PAD.left - PAD.right, height: HEIGHT, fill: "transparent" }, svg);

    hitArea.addEventListener("pointermove", (event) => {
      const svgBox = svg.getBoundingClientRect();
      const svgX = ((event.clientX - svgBox.left) / svgBox.width) * WIDTH;
      const ratio = (svgX - PAD.left) / (WIDTH - PAD.left - PAD.right);
      const i = Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1))));
      cursor.setAttribute("x1", x(i));
      cursor.setAttribute("x2", x(i));
      cursor.setAttribute("visibility", "visible");
      tip.innerHTML = `<b>${dates[i]}</b>${describe(i)}`;
      tip.style.display = "block";
      const cardBox = card.getBoundingClientRect();
      tip.style.left = `${Math.min(event.clientX - cardBox.left + 14, cardBox.width - tip.offsetWidth - 8)}px`;
      tip.style.top = `${event.clientY - cardBox.top - 10}px`;
    });
    hitArea.addEventListener("pointerleave", () => {
      tip.style.display = "none";
      cursor.setAttribute("visibility", "hidden");
    });
  }

  function renderHeader(card, { title, heroValue, note, legend }) {
    const legendItems = legend.map((series) => `<span><i style="background:${series.color}"></i>${series.name}</span>`).join("");
    card.innerHTML = `<h3>${title}</h3><p class="viz-hero">${heroValue}<small>${note}</small></p><div class="viz-legend">${legendItems}</div>`;
  }

  function createChartSvg(card, title) {
    const svg = createSvgElement("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: "img", "aria-label": title });
    card.appendChild(svg);
    return svg;
  }

  function renderLineChart(card, dates, { title, unit, digits, series }) {
    const isSingle = series.length === 1;
    const latestTotal = series.reduce((sum, item) => sum + lastValue(item.values), 0);
    const firstValue = series[0].values.find((value) => value != null);
    const note = isSingle ? `${latestTotal - firstValue >= 0 ? "+" : ""}${formatValue(latestTotal - firstValue, unit, digits)} (3개월 전 대비)` : "";
    renderHeader(card, { title, heroValue: formatValue(latestTotal, unit, digits), note, legend: isSingle ? [] : series });

    const allValues = series.flatMap((item) => item.values).filter((value) => value != null);
    const ticks = buildNiceTicks(Math.min(...allValues), Math.max(...allValues));
    const svg = createChartSvg(card, title);
    const { x, y } = drawFrame(svg, dates, ticks, unit);

    series.forEach((item) => {
      const points = item.values.map((value, i) => (value == null ? null : [x(i), y(value)])).filter(Boolean);
      const path = points.map((point) => point.join(",")).join(" L");
      if (isSingle) {
        const floor = y(ticks[0]);
        createSvgElement("path", { d: `M${points[0][0]},${floor} L${path} L${points[points.length - 1][0]},${floor} Z`, fill: item.color, "fill-opacity": 0.1 }, svg);
      }
      createSvgElement("path", { d: `M${path}`, class: "viz-line", stroke: item.color }, svg);
      const end = points[points.length - 1];
      createSvgElement("circle", { cx: end[0], cy: end[1], r: 4, fill: item.color, class: "viz-dot" }, svg);
      if (!isSingle) createSvgElement("text", { x: end[0] + 8, y: end[1] + 4, class: "viz-end-label" }, svg).textContent = item.name;
    });

    attachHover({
      card, svg, dates, x,
      describe: (i) => series.map((item) => `<span><i style="background:${item.color}"></i>${isSingle ? "" : `${item.name} `}${formatValue(item.values[i], unit, digits)}</span>`).join("<br>"),
    });
  }

  function buildColumnPath(left, right, top, bottom) {
    const radius = Math.min(BAR_RADIUS, (right - left) / 2, (bottom - top) / 2);
    return `M${left},${bottom} L${left},${top + radius} Q${left},${top} ${left + radius},${top} L${right - radius},${top} Q${right},${top} ${right},${top + radius} L${right},${bottom} Z`;
  }

  function renderColumnChart(card, dates, { title, unit, digits, values, ratios, color }) {
    const validValues = values.filter((value) => value != null);
    const average = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
    renderHeader(card, { title, heroValue: formatValue(lastValue(values), unit, digits), note: `3개월 평균 ${formatValue(average, unit, digits)}`, legend: [] });

    const ticks = buildNiceTicks(0, Math.max(...validValues));
    const svg = createChartSvg(card, title);
    const { x, y } = drawFrame(svg, dates, ticks, unit);
    const slotWidth = (WIDTH - PAD.left - PAD.right) / dates.length;
    const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slotWidth - BAR_GAP));

    values.forEach((value, i) => {
      if (value == null) return;
      const left = x(i) - barWidth / 2;
      createSvgElement("path", { d: buildColumnPath(left, left + barWidth, y(value), y(0)), fill: color }, svg);
    });
    createSvgElement("line", { x1: PAD.left, x2: WIDTH - PAD.right, y1: y(0), y2: y(0), class: "viz-baseline" }, svg);

    attachHover({
      card, svg, dates, x,
      describe: (i) => `<span><i style="background:${color}"></i>${formatValue(values[i], unit, digits)}</span>` +
        (ratios[i] == null ? "" : `<br><span>미수금 대비 ${ratios[i].toFixed(1)}%</span>`),
    });
  }

  function renderLiquidityCharts(container, rows) {
    const dates = rows.map((row) => row.date);
    const pick = (key, divisor) => rows.map((row) => (row[key] == null ? null : row[key] / divisor));
    const cards = ["deposit", "credit", "liquidation"].map(() => {
      const card = document.createElement("div");
      card.className = "viz-card";
      container.appendChild(card);
      return card;
    });

    renderLineChart(cards[0], dates, { title: "투자자예탁금", unit: "조", digits: 1, series: [{ name: "투자자예탁금", color: SERIES_1, values: pick("investor_deposit", TRILLION) }] });
    renderLineChart(cards[1], dates, {
      title: "신용거래융자 잔고", unit: "조", digits: 1,
      series: [
        { name: "코스피", color: SERIES_1, values: pick("credit_loan_kospi", TRILLION) },
        { name: "코스닥", color: SERIES_2, values: pick("credit_loan_kosdaq", TRILLION) },
      ],
    });
    renderColumnChart(cards[2], dates, {
      title: "반대매매", unit: "억", digits: 0, color: SERIES_1,
      values: pick("forced_liquidation_amount", HUNDRED_MILLION), ratios: pick("forced_liquidation_ratio", 1),
    });
  }

  document.querySelectorAll(CONTAINER_SELECTOR).forEach((container) => {
    const dataScript = container.querySelector(DATA_SELECTOR);
    if (!dataScript) return;
    const rows = JSON.parse(dataScript.textContent);
    if (rows.length > 0) renderLiquidityCharts(container, rows);
  });
})();
