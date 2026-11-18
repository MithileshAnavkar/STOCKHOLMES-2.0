import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode, UTCTimestamp } from "lightweight-charts";
import { Candle } from "../api";

export interface Forecast { p10: number; p50: number; p90: number; horizon: number }

const sma = (c: Candle[], n: number) =>
  c.map((_, i) => (i < n - 1 ? null : { time: c[i].time, value: c.slice(i - n + 1, i + 1).reduce((a, b) => a + b.close, 0) / n }))
    .filter((x): x is { time: string; value: number } => !!x);

const addBusinessDays = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z"); let k = 0;
  while (k < n) { t.setUTCDate(t.getUTCDate() + 1); if (t.getUTCDay() % 6) k++; }
  return t.toISOString().slice(0, 10);
};

export default function CandleChart({ candles, forecast }: { candles: Candle[]; forecast?: Forecast | null }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || !candles.length) return;
    const chart = createChart(el.current, {
      height: 420, autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9AA7BD", fontFamily: "Space Grotesk" },
      grid: { vertLines: { color: "rgba(154,167,189,.06)" }, horzLines: { color: "rgba(154,167,189,.06)" } },
      crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: "rgba(154,167,189,.2)" },
      timeScale: { borderColor: "rgba(154,167,189,.2)" },
    });
    const cs = chart.addCandlestickSeries({ upColor: "#2DF5A0", downColor: "#FF4D6D", borderVisible: false, wickUpColor: "#2DF5A0", wickDownColor: "#FF4D6D" });
    cs.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    chart.addLineSeries({ color: "#4DA3FF", lineWidth: 1, priceLineVisible: false, title: "SMA20" }).setData(sma(candles, 20));
    chart.addLineSeries({ color: "#9B7BFF", lineWidth: 1, priceLineVisible: false, title: "SMA50" }).setData(sma(candles, 50));
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", color: "rgba(154,167,189,.25)" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(candles.map((c) => ({ time: c.time, value: c.volume })));
    if (forecast) {
      const last = candles[candles.length - 1], end = addBusinessDays(last.time, forecast.horizon);
      ([["p90", "#2DF5A055"], ["p50", "#FFB547"], ["p10", "#FF4D6D55"]] as const).forEach(([k, color]) =>
        chart.addLineSeries({ color, lineWidth: 2, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
          .setData([{ time: last.time, value: last.close }, { time: end, value: forecast[k] }]));
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, forecast]);
  return <div ref={el} className="w-full" />;
}
export type { UTCTimestamp };
