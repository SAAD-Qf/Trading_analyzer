/**
 * Multi-Timeframe Confluence System
 */

const marketData = require('./market-data');
const analyzer = require('./advanced-analyzer-v3');

class MultiTimeframeAnalysis {
  async analyzeSymbol(symbol) {
    const timeframes = {
      '5m': await marketData.getSpotKlines(symbol, '5m', 100),
      '15m': await marketData.getSpotKlines(symbol, '15m', 100),
      '1h': await marketData.getSpotKlines(symbol, '1h', 100),
      '4h': await marketData.getSpotKlines(symbol, '4h', 100)
    };

    const signals = {};

    for (const [tf, klines] of Object.entries(timeframes)) {
      if (!klines || klines.length < 50) continue;
      signals[tf] = this.analyzeTimeframe(klines);
    }

    return this.calculateConfluence(signals);
  }

  analyzeTimeframe(klines) {
    const prices = klines.map(k => parseFloat(k[4]));
    const closes = prices.slice(-50);

    const rsi = analyzer.calculateRSI(closes, 14);
    const ema20 = analyzer.calculateEMA(closes, 20);
    const ema50 = analyzer.calculateEMA(closes, 50);
    const macd = analyzer.calculateMACD(closes);
    const currentPrice = closes[closes.length - 1];

    let score = 0;
    const reasons = [];

    // Trend
    if (currentPrice > ema20 && ema20 > ema50) {
      score += 2;
      reasons.push('Bullish trend');
    } else if (currentPrice < ema20 && ema20 < ema50) {
      score -= 2;
      reasons.push('Bearish trend');
    }

    // Momentum
    if (rsi < 35) {
      score += 2;
      reasons.push(`RSI oversold (${rsi.toFixed(1)})`);
    } else if (rsi > 65) {
      score -= 2;
      reasons.push(`RSI overbought (${rsi.toFixed(1)})`);
    }

    // MACD
    if (macd && macd.crossover) {
      if (macd.bullish) {
        score += 1.5;
        reasons.push('MACD bullish cross');
      } else {
        score -= 1.5;
        reasons.push('MACD bearish cross');
      }
    }

    return {
      signal: score >= 3 ? 'BULL' : score <= -3 ? 'BEAR' : 'NEUTRAL',
      score,
      reasons,
      price: currentPrice
    };
  }

  calculateConfluence(signals) {
    const timeframes = Object.keys(signals);
    if (timeframes.length < 3) return null;

    let bullCount = 0;
    let bearCount = 0;
    let totalScore = 0;
    const allReasons = [];

    for (const [tf, data] of Object.entries(signals)) {
      if (data.signal === 'BULL') bullCount++;
      if (data.signal === 'BEAR') bearCount++;
      totalScore += data.score;

      data.reasons.forEach(r => allReasons.push(`[${tf}] ${r}`));
    }

    const confluence = {
      aligned: false,
      direction: 'NEUTRAL',
      strength: 0,
      score: totalScore,
      timeframes: signals,
      reasons: allReasons.slice(0, 6)
    };

    // Require 3 out of 4 timeframes to align
    if (bullCount >= 3) {
      confluence.aligned = true;
      confluence.direction = 'BULLISH';
      confluence.strength = (bullCount / timeframes.length) * 100;
    } else if (bearCount >= 3) {
      confluence.aligned = true;
      confluence.direction = 'BEARISH';
      confluence.strength = (bearCount / timeframes.length) * 100;
    }

    return confluence;
  }

  // Quick check for single strategy
  async checkConfluence(symbol, strategy) {
    const tfMap = {
      'scalping': ['5m', '15m'],
      'intraday': ['15m', '1h', '4h'],
      'swing': ['1h', '4h', '1d']
    };

    const relevantTFs = tfMap[strategy] || ['5m', '15m', '1h'];
    const signals = {};

    for (const tf of relevantTFs) {
      const klines = await marketData.getSpotKlines(symbol, tf, 100);
      if (klines && klines.length >= 50) {
        signals[tf] = this.analyzeTimeframe(klines);
      }
    }

    // All timeframes must agree
    const directions = Object.values(signals).map(s => s.signal);
    const allBull = directions.every(d => d === 'BULL');
    const allBear = directions.every(d => d === 'BEAR');

    return {
      confirmed: allBull || allBear,
      direction: allBull ? 'BULL' : allBear ? 'BEAR' : 'MIXED',
      signals
    };
  }
}

module.exports = new MultiTimeframeAnalysis();
