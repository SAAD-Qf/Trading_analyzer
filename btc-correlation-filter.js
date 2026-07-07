/**
 * BTC Correlation Filter
 * Prevents trading altcoins against BTC trend
 */

const marketData = require('./market-data');

class BTCCorrelationFilter {
  constructor() {
    this.btcCache = null;
    this.cacheTimestamp = 0;
    this.cacheDuration = 30000; // 30 seconds
  }

  async getBTCContext() {
    const now = Date.now();

    // Use cache if fresh
    if (this.btcCache && (now - this.cacheTimestamp) < this.cacheDuration) {
      return this.btcCache;
    }

    try {
      // Fetch BTC data
      const btcPrice = await marketData.getSpotPrice('BTCUSDT');
      const btcKlines1h = await marketData.getSpotKlines('BTCUSDT', '1h', 100);
      const btcKlines4h = await marketData.getSpotKlines('BTCUSDT', '4h', 100);

      if (!btcPrice || !btcKlines1h || !btcKlines4h) return null;

      const currentPrice = parseFloat(btcPrice.lastPrice);
      const priceChange24h = parseFloat(btcPrice.priceChangePercent);

      const closes1h = btcKlines1h.map(k => parseFloat(k[4]));
      const closes4h = btcKlines4h.map(k => parseFloat(k[4]));

      // Calculate EMAs
      const ema20 = this.calculateEMA(closes1h, 20);
      const ema50 = this.calculateEMA(closes1h, 50);
      const ema200 = this.calculateEMA(closes4h, 200);

      // Determine BTC trend
      let trend = 'NEUTRAL';
      let strength = 0;

      if (currentPrice > ema20 && ema20 > ema50 && currentPrice > ema200) {
        trend = 'STRONG_BULL';
        strength = 3;
      } else if (currentPrice > ema20 && ema20 > ema50) {
        trend = 'BULL';
        strength = 2;
      } else if (currentPrice > ema50) {
        trend = 'WEAK_BULL';
        strength = 1;
      } else if (currentPrice < ema20 && ema20 < ema50 && currentPrice < ema200) {
        trend = 'STRONG_BEAR';
        strength = -3;
      } else if (currentPrice < ema20 && ema20 < ema50) {
        trend = 'BEAR';
        strength = -2;
      } else if (currentPrice < ema50) {
        trend = 'WEAK_BEAR';
        strength = -1;
      }

      this.btcCache = {
        price: currentPrice,
        priceChange24h,
        ema20,
        ema50,
        ema200,
        trend,
        strength,
        timestamp: now
      };

      this.cacheTimestamp = now;
      return this.btcCache;

    } catch (error) {
      console.error('❌ BTC Context error:', error.message);
      return null;
    }
  }

  async shouldAllowSignal(symbol, signal) {
    // BTC itself - always allow
    if (symbol === 'BTCUSDT') {
      return { allowed: true, reason: 'BTC - no filter' };
    }

    // HOLD signals - always allow
    if (signal.action === 'HOLD') {
      return { allowed: true, reason: 'HOLD signal' };
    }

    const btc = await this.getBTCContext();
    if (!btc) {
      return { allowed: true, reason: 'BTC data unavailable' };
    }

    const isLongSignal = signal.action.includes('BUY');
    const isShortSignal = signal.action.includes('SELL');

    // Rule 1: Block longs when BTC is in strong downtrend
    if (isLongSignal && btc.trend === 'STRONG_BEAR') {
      return {
        allowed: false,
        reason: `BTC in strong downtrend (${btc.price.toFixed(0)} < EMA200)`,
        btcTrend: btc.trend
      };
    }

    // Rule 2: Block longs when BTC is dumping hard
    if (isLongSignal && btc.priceChange24h < -5) {
      return {
        allowed: false,
        reason: `BTC dumping ${btc.priceChange24h.toFixed(1)}%`,
        btcTrend: btc.trend
      };
    }

    // Rule 3: Block shorts when BTC is in strong uptrend (for most alts)
    if (isShortSignal && btc.trend === 'STRONG_BULL' && !this.isInverseBTCAsset(symbol)) {
      return {
        allowed: false,
        reason: `BTC in strong uptrend (${btc.price.toFixed(0)} > EMA200)`,
        btcTrend: btc.trend
      };
    }

    // Rule 4: Reduce confidence when BTC trend conflicts with signal
    if (isLongSignal && btc.strength < 0) {
      return {
        allowed: true,
        reason: 'Allowed but reduced confidence',
        btcTrend: btc.trend,
        confidencePenalty: 0.7, // Reduce confidence by 30%
        warning: 'BTC bearish - risky long'
      };
    }

    if (isShortSignal && btc.strength > 0) {
      return {
        allowed: true,
        reason: 'Allowed but reduced confidence',
        btcTrend: btc.trend,
        confidencePenalty: 0.7,
        warning: 'BTC bullish - risky short'
      };
    }

    // Rule 5: Boost confidence when BTC aligns
    let confidenceBonus = 1.0;
    if (isLongSignal && btc.strength > 0) {
      confidenceBonus = 1.2; // 20% boost
    } else if (isShortSignal && btc.strength < 0) {
      confidenceBonus = 1.2;
    }

    return {
      allowed: true,
      reason: 'BTC trend aligned',
      btcTrend: btc.trend,
      confidenceBonus,
      btcContext: `BTC: ${btc.trend} @ $${btc.price.toFixed(0)}`
    };
  }

  isInverseBTCAsset(symbol) {
    // Some assets move inverse to BTC (rare, but exists)
    const inverseAssets = [];
    return inverseAssets.includes(symbol);
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
}

module.exports = new BTCCorrelationFilter();
