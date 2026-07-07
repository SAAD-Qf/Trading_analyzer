/**
 * Advanced Trading Analyzer V3
 * Complete Professional System with ALL Indicators
 */

const config = require('./config');
const advancedIndicators = require('./advanced-indicators');

class AdvancedAnalyzerV3 {
  constructor() {
    this.cvdHistory = new Map();
    this.priceHistory = new Map();
  }

  // ==================== ESSENTIAL INDICATORS ====================

  calculateEMA(prices, period) {
    if (prices.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    let gains = 0, losses = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) gains += changes[i];
      else losses -= changes[i];
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = (avgGain * (period - 1) + changes[i]) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - changes[i]) / period;
      }
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    if (!ema12 || !ema26) return null;
    const macdLine = ema12 - ema26;

    const macdHistory = [];
    for (let i = 26; i < prices.length; i++) {
      const slice = prices.slice(0, i + 1);
      const e12 = this.calculateEMA(slice, 12);
      const e26 = this.calculateEMA(slice, 26);
      macdHistory.push(e12 - e26);
    }
    const signalLine = macdHistory.length >= 9 ? this.calculateEMA(macdHistory, 9) : macdLine;
    const histogram = macdLine - signalLine;

    return {
      macdLine,
      signalLine,
      histogram,
      bullish: histogram > 0,
      crossover: histogram > 0 && Math.abs(histogram) < Math.abs(macdLine) * 0.1
    };
  }

  // ==================== CVD (Cumulative Volume Delta) ====================

  calculateCVD(trades) {
    if (!trades || trades.length === 0) return { cvd: 0, buyVolume: 0, sellVolume: 0, pressure: 'NEUTRAL' };

    let buyVolume = 0;
    let sellVolume = 0;

    trades.forEach(trade => {
      const volume = parseFloat(trade.qty || trade.quoteQty || 0);
      if (trade.isBuyerMaker === false) {
        buyVolume += volume;
      } else {
        sellVolume += volume;
      }
    });

    const cvd = buyVolume - sellVolume;
    const ratio = sellVolume > 0 ? buyVolume / sellVolume : (buyVolume > 0 ? 999 : 1);

    let pressure = 'NEUTRAL';
    if (ratio > 1.5) pressure = 'STRONG_BUY';
    else if (ratio > 1.1) pressure = 'BUY';
    else if (ratio < 0.67) pressure = 'STRONG_SELL';
    else if (ratio < 0.9) pressure = 'SELL';

    return {
      cvd,
      buyVolume,
      sellVolume,
      ratio,
      pressure,
      significant: Math.abs(cvd) > 500000
    };
  }

  // ==================== FOOTPRINT ANALYSIS ====================

  analyzeFootprint(trades, currentPrice) {
    if (!trades || trades.length === 0) return null;

    const priceStep = currentPrice > 1000 ? 10 : currentPrice > 100 ? 1 : 0.01;
    const levels = new Map();

    trades.forEach(trade => {
      const price = parseFloat(trade.price);
      const volume = parseFloat(trade.qty || trade.quoteQty || 0);
      const isBuy = trade.isBuyerMaker === false;

      const level = Math.round(price / priceStep) * priceStep;
      if (!levels.has(level)) {
        levels.set(level, { buyVolume: 0, sellVolume: 0, totalVolume: 0, trades: 0 });
      }

      const data = levels.get(level);
      data.totalVolume += volume;
      data.trades += 1;
      if (isBuy) data.buyVolume += volume;
      else data.sellVolume += volume;
    });

    const footprint = Array.from(levels.entries())
      .map(([price, data]) => ({
        price,
        ...data,
        delta: data.buyVolume - data.sellVolume,
        dominance: data.totalVolume > 0 ? (Math.max(data.buyVolume, data.sellVolume) / data.totalVolume) : 0.5,
        type: data.buyVolume > data.sellVolume ? 'BUY' : 'SELL'
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);

    const avgVolume = footprint.reduce((sum, f) => sum + f.totalVolume, 0) / footprint.length;
    const highVolumeNodes = footprint.filter(f => f.totalVolume > avgVolume * 2.5).slice(0, 5);
    const poc = footprint[0];

    return {
      highVolumeNodes,
      pointOfControl: poc,
      avgVolume,
      currentLevel: footprint.find(f => Math.abs(f.price - currentPrice) < priceStep * 2),
    };
  }

  // ==================== WHALE VS RETAIL DETECTION ====================

  detectWhaleRetailOrders(orderBook, currentPrice, footprint) {
    if (!orderBook || !orderBook.bids || !orderBook.asks) return null;

    const bids = orderBook.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
    const asks = orderBook.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));

    const allVolumes = [...bids.map(b => b.qty), ...asks.map(a => a.qty)];
    const avgVolume = allVolumes.reduce((sum, v) => sum + v, 0) / allVolumes.length;
    const stdDev = Math.sqrt(
      allVolumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / allVolumes.length
    );

    const whaleThreshold = avgVolume + (stdDev * 3);
    const largeOrderThreshold = avgVolume + (stdDev * 2);

    const whaleBids = bids.filter(b => b.qty > whaleThreshold);
    const whaleAsks = asks.filter(a => a.qty > whaleThreshold);
    const largeBids = bids.filter(b => b.qty > largeOrderThreshold && b.qty <= whaleThreshold);
    const largeAsks = asks.filter(a => a.qty > largeOrderThreshold && a.qty <= whaleThreshold);
    const retailBids = bids.filter(b => b.qty <= avgVolume);
    const retailAsks = asks.filter(a => a.qty <= avgVolume);

    const priceRange = currentPrice * 0.02;
    const nearbyWhaleBids = whaleBids.filter(b => currentPrice - b.price < priceRange);
    const nearbyWhaleAsks = whaleAsks.filter(a => a.price - currentPrice < priceRange);

    const whaleSupport = whaleBids.reduce((sum, b) => sum + b.qty, 0);
    const whaleResistance = whaleAsks.reduce((sum, a) => sum + a.qty, 0);
    const retailSupport = retailBids.reduce((sum, b) => sum + b.qty, 0);
    const retailResistance = retailAsks.reduce((sum, a) => sum + a.qty, 0);

    const totalBuyPressure = whaleSupport + retailSupport;
    const totalSellPressure = whaleResistance + retailResistance;
    const whaleControlBuy = whaleSupport > 0 ? whaleSupport / totalBuyPressure : 0;
    const whaleControlSell = whaleResistance > 0 ? whaleResistance / totalSellPressure : 0;

    return {
      whales: {
        bids: whaleBids.slice(0, 3),
        asks: whaleAsks.slice(0, 3),
        supportVolume: whaleSupport,
        resistanceVolume: whaleResistance,
        controlBuy: whaleControlBuy,
        controlSell: whaleControlSell,
        nearby: {
          support: nearbyWhaleBids,
          resistance: nearbyWhaleAsks
        }
      },
      retail: {
        supportVolume: retailSupport,
        resistanceVolume: retailResistance,
        orderCount: retailBids.length + retailAsks.length
      },
      smartMoney: {
        bids: largeBids.slice(0, 5),
        asks: largeAsks.slice(0, 5)
      },
      marketControl: whaleControlBuy > 0.6 || whaleControlSell > 0.6 ? 'WHALE_DOMINATED' :
                     whaleControlBuy > 0.4 || whaleControlSell > 0.4 ? 'MIXED' : 'RETAIL_DOMINATED'
    };
  }

  // ==================== ANTI-TRAP DETECTION ====================

  detectTraps(orderBook, whaleRetailData, priceHistory, currentPrice) {
    const traps = [];

    if (!whaleRetailData || !orderBook) return { detected: false, traps: [] };

    const { whales } = whaleRetailData;

    if (whales.nearby.support.length > 0 && whales.nearby.resistance.length > 0) {
      traps.push({
        type: 'POTENTIAL_SQUEEZE',
        severity: 'HIGH',
        description: 'Whale walls on both sides - potential squeeze zone',
        priceLevel: currentPrice,
        action: 'CAUTION'
      });
    }

    whales.bids.forEach(bid => {
      const stopHuntLevel = bid.price * 0.995;
      const nearPrice = Math.abs(currentPrice - stopHuntLevel) / currentPrice < 0.01;

      if (nearPrice) {
        traps.push({
          type: 'STOP_HUNT_ZONE',
          severity: 'MEDIUM',
          description: `Potential stop-loss hunting zone near $${stopHuntLevel.toFixed(4)}`,
          priceLevel: stopHuntLevel,
          action: 'AVOID_TIGHT_STOPS'
        });
      }
    });

    if (priceHistory && priceHistory.length > 10) {
      const recentPrices = priceHistory.slice(-10);
      const avgRecent = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
      const deviation = Math.abs(currentPrice - avgRecent) / avgRecent;

      if (deviation > 0.015) {
        traps.push({
          type: 'LIQUIDITY_GRAB',
          severity: 'HIGH',
          description: 'Rapid price movement - possible liquidity grab in progress',
          priceLevel: currentPrice,
          action: 'WAIT_FOR_CONFIRMATION'
        });
      }
    }

    const bidVolume = orderBook.bids.reduce((sum, b) => sum + parseFloat(b[1]), 0);
    const askVolume = orderBook.asks.reduce((sum, a) => sum + parseFloat(a[1]), 0);
    const imbalance = Math.abs(bidVolume - askVolume) / (bidVolume + askVolume);

    if (imbalance > 0.7) {
      traps.push({
        type: 'FAKE_WALL_SUSPECTED',
        severity: 'MEDIUM',
        description: `Extreme order book imbalance (${(imbalance * 100).toFixed(1)}%) - walls might be fake`,
        priceLevel: currentPrice,
        action: 'VERIFY_WITH_VOLUME'
      });
    }

    return {
      detected: traps.length > 0,
      count: traps.length,
      traps: traps.sort((a, b) => {
        const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
    };
  }

  // ==================== COMPREHENSIVE SIGNAL GENERATION ====================

  generateComprehensiveSignals(analysis) {
    const {
      rsi, ema20, ema50, ema200, macd, cvd, footprint, whaleRetail, antiTrap, price,
      vwap, atr, volumeProfile, orderImbalance, candlePatterns, obv, fibonacci,
      marketStructure, fundingDivergence, deltaDivergence
    } = analysis;

    let scalpScore = 0, intradayScore = 0, swingScore = 0;
    const signals = { scalping: [], intraday: [], swing: [] };

    // === SCALPING SIGNALS (1m-5m) ===
    if (cvd && cvd.pressure === 'STRONG_BUY') {
      scalpScore += 3;
      signals.scalping.push({ reason: 'Strong CVD buy pressure', weight: 3 });
    } else if (cvd && cvd.pressure === 'STRONG_SELL') {
      scalpScore -= 3;
      signals.scalping.push({ reason: 'Strong CVD sell pressure', weight: -3 });
    }

    if (orderImbalance && orderImbalance.signal === 'STRONG_BUY') {
      scalpScore += 2.5;
      signals.scalping.push({ reason: `Order book imbalance: ${orderImbalance.imbalance.toFixed(1)}% buy pressure`, weight: 2.5 });
    } else if (orderImbalance && orderImbalance.signal === 'STRONG_SELL') {
      scalpScore -= 2.5;
      signals.scalping.push({ reason: `Order book imbalance: ${Math.abs(orderImbalance.imbalance).toFixed(1)}% sell pressure`, weight: -2.5 });
    }

    if (footprint && footprint.pointOfControl && footprint.pointOfControl.type === 'BUY') {
      scalpScore += 2;
      signals.scalping.push({ reason: 'Footprint POC is bullish', weight: 2 });
    } else if (footprint && footprint.pointOfControl && footprint.pointOfControl.type === 'SELL') {
      scalpScore -= 2;
      signals.scalping.push({ reason: 'Footprint POC is bearish', weight: -2 });
    }

    if (whaleRetail && whaleRetail.whales.nearby.support.length > 0) {
      scalpScore += 1.5;
      signals.scalping.push({ reason: 'Whale support nearby', weight: 1.5 });
    }
    if (whaleRetail && whaleRetail.whales.nearby.resistance.length > 0) {
      scalpScore -= 1.5;
      signals.scalping.push({ reason: 'Whale resistance nearby', weight: -1.5 });
    }

    if (deltaDivergence && deltaDivergence.signal === 'HIDDEN_ACCUMULATION') {
      scalpScore += 2;
      signals.scalping.push({ reason: 'Delta divergence: hidden accumulation', weight: 2 });
    } else if (deltaDivergence && deltaDivergence.signal === 'HIDDEN_DISTRIBUTION') {
      scalpScore -= 2;
      signals.scalping.push({ reason: 'Delta divergence: hidden distribution', weight: -2 });
    }

    // === INTRADAY SIGNALS (15m-1h) ===
    if (rsi < 35) {
      intradayScore += 2.5;
      signals.intraday.push({ reason: `RSI oversold (${rsi.toFixed(1)})`, weight: 2.5 });
    } else if (rsi > 65) {
      intradayScore -= 2.5;
      signals.intraday.push({ reason: `RSI overbought (${rsi.toFixed(1)})`, weight: -2.5 });
    }

    if (price > ema20 && ema20 > ema50) {
      intradayScore += 2;
      signals.intraday.push({ reason: 'Bullish EMA alignment', weight: 2 });
    } else if (price < ema20 && ema20 < ema50) {
      intradayScore -= 2;
      signals.intraday.push({ reason: 'Bearish EMA alignment', weight: -2 });
    }

    if (macd && macd.crossover && macd.bullish) {
      intradayScore += 2.5;
      signals.intraday.push({ reason: 'MACD bullish crossover', weight: 2.5 });
    } else if (macd && macd.crossover && !macd.bullish) {
      intradayScore -= 2.5;
      signals.intraday.push({ reason: 'MACD bearish crossover', weight: -2.5 });
    }

    if (vwap && vwap.signal === 'BULLISH' && vwap.deviation > 0.5) {
      intradayScore += 2;
      signals.intraday.push({ reason: `Price ${vwap.deviation.toFixed(2)}% above VWAP`, weight: 2 });
    } else if (vwap && vwap.signal === 'BEARISH' && vwap.deviation < -0.5) {
      intradayScore -= 2;
      signals.intraday.push({ reason: `Price ${Math.abs(vwap.deviation).toFixed(2)}% below VWAP`, weight: -2 });
    }

    if (candlePatterns && candlePatterns.signal === 'BULLISH' && candlePatterns.strength > 2) {
      intradayScore += 2;
      signals.intraday.push({ reason: `Bullish pattern: ${candlePatterns.patterns[0]?.name}`, weight: 2 });
    } else if (candlePatterns && candlePatterns.signal === 'BEARISH' && candlePatterns.strength > 2) {
      intradayScore -= 2;
      signals.intraday.push({ reason: `Bearish pattern: ${candlePatterns.patterns[0]?.name}`, weight: -2 });
    }

    if (obv && obv.divergence === 'BULLISH') {
      intradayScore += 2;
      signals.intraday.push({ reason: 'OBV bullish divergence', weight: 2 });
    } else if (obv && obv.divergence === 'BEARISH') {
      intradayScore -= 2;
      signals.intraday.push({ reason: 'OBV bearish divergence', weight: -2 });
    }

    // === SWING SIGNALS (4h-1D) ===
    if (ema200 && price > ema200) {
      swingScore += 2.5;
      signals.swing.push({ reason: 'Above EMA200 (long-term bullish)', weight: 2.5 });
    } else if (ema200 && price < ema200) {
      swingScore -= 2.5;
      signals.swing.push({ reason: 'Below EMA200 (long-term bearish)', weight: -2.5 });
    }

    if (marketStructure && marketStructure.structure === 'UPTREND') {
      swingScore += 2.5;
      signals.swing.push({ reason: 'Market structure: uptrend', weight: 2.5 });
    } else if (marketStructure && marketStructure.structure === 'DOWNTREND') {
      swingScore -= 2.5;
      signals.swing.push({ reason: 'Market structure: downtrend', weight: -2.5 });
    }

    if (marketStructure && marketStructure.breakout === 'BULLISH_BREAKOUT') {
      swingScore += 3;
      signals.swing.push({ reason: 'Bullish structure breakout', weight: 3 });
    } else if (marketStructure && marketStructure.breakout === 'BEARISH_BREAKOUT') {
      swingScore -= 3;
      signals.swing.push({ reason: 'Bearish structure breakout', weight: -3 });
    }

    if (volumeProfile && volumeProfile.position === 'ABOVE_VALUE') {
      swingScore += 1.5;
      signals.swing.push({ reason: 'Price above value area', weight: 1.5 });
    } else if (volumeProfile && volumeProfile.position === 'BELOW_VALUE') {
      swingScore -= 1.5;
      signals.swing.push({ reason: 'Price below value area', weight: -1.5 });
    }

    if (fibonacci && fibonacci.atKeyLevel) {
      const fibSignal = fibonacci.trend === 'UPTREND' ? 1.5 : -1.5;
      swingScore += fibSignal;
      signals.swing.push({ reason: `At Fibonacci ${fibonacci.nearestLevel.name} level`, weight: fibSignal });
    }

    if (whaleRetail && whaleRetail.marketControl === 'WHALE_DOMINATED') {
      if (whaleRetail.whales.controlBuy > 0.7) {
        swingScore += 2;
        signals.swing.push({ reason: 'Whales accumulating', weight: 2 });
      } else if (whaleRetail.whales.controlSell > 0.7) {
        swingScore -= 2;
        signals.swing.push({ reason: 'Whales distributing', weight: -2 });
      }
    }

    if (fundingDivergence && fundingDivergence.signal === 'POTENTIAL_LONG_SQUEEZE') {
      swingScore += 2;
      signals.swing.push({ reason: 'Funding divergence: potential squeeze', weight: 2 });
    }

    // Apply anti-trap penalty
    if (antiTrap && antiTrap.detected) {
      const highSeverityTraps = antiTrap.traps.filter(t => t.severity === 'HIGH').length;
      const penalty = highSeverityTraps * 1.5;

      scalpScore -= penalty * 0.5;
      intradayScore -= penalty * 0.3;
      swingScore -= penalty * 0.2;

      signals.scalping.push({ reason: `Anti-trap: ${antiTrap.count} traps detected`, weight: -penalty * 0.5 });
      signals.intraday.push({ reason: `Anti-trap: ${antiTrap.count} traps detected`, weight: -penalty * 0.3 });
      signals.swing.push({ reason: `Anti-trap: ${antiTrap.count} traps detected`, weight: -penalty * 0.2 });
    }

    const result = {
      scalping: this.generateSignalOutput(scalpScore, signals.scalping, 'SCALPING'),
      intraday: this.generateSignalOutput(intradayScore, signals.intraday, 'INTRADAY'),
      swing: this.generateSignalOutput(swingScore, signals.swing, 'SWING'),
      antiTrap: antiTrap,
      whaleActivity: whaleRetail ? {
        control: whaleRetail.marketControl,
        supportStrength: whaleRetail.whales.supportVolume,
        resistanceStrength: whaleRetail.whales.resistanceVolume,
        whaleOrdersNearby: whaleRetail.whales.nearby.support.length + whaleRetail.whales.nearby.resistance.length
      } : null,
      advancedMetrics: {
        vwap: vwap ? `${vwap.signal} (${vwap.deviation.toFixed(2)}%)` : null,
        atr: atr ? `${atr.volatility} (${atr.percent.toFixed(2)}%)` : null,
        volumeProfile: volumeProfile ? volumeProfile.position : null,
        marketStructure: marketStructure ? marketStructure.structure : null,
        candlePatterns: candlePatterns ? `${candlePatterns.count} patterns` : null,
        obv: obv ? obv.signal : null
      }
    };

    return result;
  }

  generateSignalOutput(score, signals, type) {
    let action = 'HOLD';
    let confidence = 'LOW';

    const absScore = Math.abs(score);

    if (score >= 7) {
      action = 'STRONG BUY';
      confidence = 'HIGH';
    } else if (score >= 4) {
      action = 'BUY';
      confidence = 'MEDIUM';
    } else if (score <= -7) {
      action = 'STRONG SELL';
      confidence = 'HIGH';
    } else if (score <= -4) {
      action = 'SELL';
      confidence = 'MEDIUM';
    }

    const accuracy = this.estimateAccuracy(signals, absScore);

    return {
      type,
      action,
      confidence,
      score: score.toFixed(2),
      accuracy: `${accuracy}%`,
      signals: signals.slice(0, 5),
      timeframe: type === 'SCALPING' ? '1m-5m' : type === 'INTRADAY' ? '15m-1h' : '4h-1D'
    };
  }

  estimateAccuracy(signals, score) {
    let accuracy = 65;

    if (signals.length >= 6) accuracy += 20;
    else if (signals.length >= 4) accuracy += 15;
    else if (signals.length >= 2) accuracy += 10;

    if (score >= 8) accuracy += 15;
    else if (score >= 5) accuracy += 10;
    else if (score >= 3) accuracy += 5;

    return Math.min(95, Math.max(65, Math.round(accuracy)));
  }

  // Update CVD and price history for divergence detection
  updateHistory(symbol, cvd, price) {
    if (!this.cvdHistory.has(symbol)) {
      this.cvdHistory.set(symbol, []);
    }
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const cvdHist = this.cvdHistory.get(symbol);
    const priceHist = this.priceHistory.get(symbol);

    cvdHist.push(cvd);
    priceHist.push(price);

    if (cvdHist.length > 50) cvdHist.shift();
    if (priceHist.length > 50) priceHist.shift();
  }

  getHistories(symbol) {
    return {
      cvdHistory: this.cvdHistory.get(symbol) || [],
      priceHistory: this.priceHistory.get(symbol) || []
    };
  }
}

module.exports = new AdvancedAnalyzerV3();
