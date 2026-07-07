/**
 * Market Regime Detection System
 */

class RegimeDetector {
  detectRegime(klines, atr) {
    if (!klines || klines.length < 50) return null;

    const closes = klines.map(k => parseFloat(k[4]));
    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));

    // Calculate ADX for trend strength
    const adx = this.calculateADX(highs, lows, closes);

    // Calculate Choppiness Index
    const choppiness = this.calculateChoppiness(highs, lows, closes);

    // Determine regime
    let regime = 'RANGING';
    let characteristics = [];
    let signalAdjustment = {};

    // Trending conditions
    if (adx > 25 && choppiness < 50) {
      const ema20 = this.calculateEMA(closes, 20);
      const ema50 = this.calculateEMA(closes, 50);
      const currentPrice = closes[closes.length - 1];

      if (currentPrice > ema20 && ema20 > ema50) {
        regime = 'TRENDING_BULL';
        characteristics = ['Strong uptrend', 'Use breakout signals', 'Avoid mean reversion'];
        signalAdjustment = {
          breakout: 1.5,
          meanReversion: 0.3,
          momentum: 1.3
        };
      } else if (currentPrice < ema20 && ema20 < ema50) {
        regime = 'TRENDING_BEAR';
        characteristics = ['Strong downtrend', 'Use breakdown signals', 'Avoid mean reversion'];
        signalAdjustment = {
          breakout: 1.5,
          meanReversion: 0.3,
          momentum: 1.3
        };
      }
    }
    // Ranging conditions
    else if (adx < 20 || choppiness > 61.8) {
      regime = 'RANGING';
      characteristics = ['No clear trend', 'Use mean reversion', 'Avoid breakouts'];
      signalAdjustment = {
        breakout: 0.2,
        meanReversion: 1.5,
        momentum: 0.5
      };
    }

    // High volatility override
    if (atr && atr.percent > 3) {
      regime = 'HIGH_VOLATILITY';
      characteristics = ['Extreme volatility', 'Wider stops required', 'Reduce position size', 'Require stronger confirmation'];
      signalAdjustment = {
        breakout: 0.7,
        meanReversion: 0.7,
        momentum: 0.8,
        stopLossMultiplier: 1.5
      };
    }

    return {
      regime,
      adx: adx.toFixed(1),
      choppiness: choppiness.toFixed(1),
      volatility: atr ? atr.volatility : 'UNKNOWN',
      characteristics,
      signalAdjustment,
      confidence: this.calculateConfidence(adx, choppiness)
    };
  }

  calculateADX(highs, lows, closes, period = 14) {
    const trueRanges = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevHigh = highs[i - 1];
      const prevLow = lows[i - 1];
      const prevClose = closes[i - 1];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);

      const upMove = high - prevHigh;
      const downMove = prevLow - low;

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    // Smooth with EMA
    const smoothTR = this.smoothArray(trueRanges, period);
    const smoothPlusDM = this.smoothArray(plusDM, period);
    const smoothMinusDM = this.smoothArray(minusDM, period);

    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;

    const dx = (plusDI + minusDI) > 0 ?
      (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0;

    return dx; // Simplified ADX
  }

  calculateChoppiness(highs, lows, closes, period = 14) {
    const recent = Math.min(period, highs.length);
    const recentHighs = highs.slice(-recent);
    const recentLows = lows.slice(-recent);
    const recentCloses = closes.slice(-recent);

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    const range = highestHigh - lowestLow;

    let sumTR = 0;
    for (let i = 1; i < recentCloses.length; i++) {
      const tr = Math.max(
        recentHighs[i] - recentLows[i],
        Math.abs(recentHighs[i] - recentCloses[i - 1]),
        Math.abs(recentLows[i] - recentCloses[i - 1])
      );
      sumTR += tr;
    }

    if (range === 0) return 100;

    const choppiness = 100 * (Math.log10(sumTR / range) / Math.log10(period));
    return Math.max(0, Math.min(100, choppiness));
  }

  smoothArray(arr, period) {
    if (arr.length < period) return arr[arr.length - 1] || 0;

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += arr[i];
    }

    let smoothed = sum / period;
    for (let i = period; i < arr.length; i++) {
      smoothed = (smoothed * (period - 1) + arr[i]) / period;
    }

    return smoothed;
  }

  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  calculateConfidence(adx, choppiness) {
    // High ADX + low choppiness = high confidence
    if (adx > 30 && choppiness < 40) return 'HIGH';
    if (adx > 20 && choppiness < 50) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = new RegimeDetector();
