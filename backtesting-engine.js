/**
 * Backtesting Engine - Validates Signal Accuracy
 */

const marketData = require('./market-data');

class BacktestingEngine {
  constructor() {
    this.results = {
      scalping: { total: 0, wins: 0, losses: 0, totalProfit: 0 },
      intraday: { total: 0, wins: 0, losses: 0, totalProfit: 0 },
      swing: { total: 0, wins: 0, losses: 0, totalProfit: 0 }
    };
    this.signalLog = [];
  }

  async backtest(symbol, startDate, endDate) {
    console.log(`📊 Backtesting ${symbol} from ${startDate} to ${endDate}...`);

    try {
      const intervals = {
        scalping: '5m',
        intraday: '1h',
        swing: '4h'
      };

      for (const [strategy, interval] of Object.entries(intervals)) {
        await this.backtestStrategy(symbol, interval, strategy);
      }

      return this.calculateMetrics();
    } catch (error) {
      console.error(`❌ Backtest error:`, error.message);
      return null;
    }
  }

  async backtestStrategy(symbol, interval, strategy) {
    const klines = await marketData.getSpotKlines(symbol, interval, 1000);
    if (!klines || klines.length < 100) return;

    const analyzer = require('./advanced-analyzer-v3');

    for (let i = 100; i < klines.length - 10; i++) {
      const historicalData = klines.slice(0, i);
      const futureData = klines.slice(i, i + 10);

      // Simulate signal generation at this point
      const signal = this.generateHistoricalSignal(historicalData, analyzer);

      if (signal && Math.abs(signal.score) >= 4) {
        const outcome = this.evaluateSignal(signal, futureData);
        this.recordResult(strategy, signal, outcome);
      }
    }
  }

  generateHistoricalSignal(klines, analyzer) {
    const prices = klines.map(k => parseFloat(k[4]));
    const closes = prices.slice(-50);

    const rsi = analyzer.calculateRSI(closes, 14);
    const ema20 = analyzer.calculateEMA(closes, 20);
    const ema50 = analyzer.calculateEMA(closes, 50);
    const macd = analyzer.calculateMACD(closes);

    let score = 0;

    if (rsi < 35) score += 2.5;
    if (rsi > 65) score -= 2.5;
    if (closes[closes.length - 1] > ema20 && ema20 > ema50) score += 2;
    if (closes[closes.length - 1] < ema20 && ema20 < ema50) score -= 2;
    if (macd && macd.bullish) score += 1.5;
    if (macd && !macd.bullish) score -= 1.5;

    return {
      action: score >= 4 ? 'BUY' : score <= -4 ? 'SELL' : 'HOLD',
      score,
      price: closes[closes.length - 1]
    };
  }

  evaluateSignal(signal, futureData) {
    const entryPrice = signal.price;
    const maxPrice = Math.max(...futureData.map(k => parseFloat(k[2])));
    const minPrice = Math.min(...futureData.map(k => parseFloat(k[3])));
    const exitPrice = parseFloat(futureData[futureData.length - 1][4]);

    const priceMove = ((exitPrice - entryPrice) / entryPrice) * 100;
    const maxMove = ((maxPrice - entryPrice) / entryPrice) * 100;
    const minMove = ((minPrice - entryPrice) / entryPrice) * 100;

    let win = false;
    let profit = 0;

    if (signal.action === 'BUY') {
      win = priceMove > 0.5;
      profit = priceMove;
      if (minMove < -2) profit = -2; // Stop loss hit
      if (maxMove > 3) profit = 3; // Take profit hit
    } else if (signal.action === 'SELL') {
      win = priceMove < -0.5;
      profit = -priceMove;
      if (maxMove > 2) profit = -2; // Stop loss hit
      if (minMove < -3) profit = 3; // Take profit hit
    }

    return { win, profit, priceMove };
  }

  recordResult(strategy, signal, outcome) {
    this.results[strategy].total++;
    if (outcome.win) {
      this.results[strategy].wins++;
    } else {
      this.results[strategy].losses++;
    }
    this.results[strategy].totalProfit += outcome.profit;
  }

  calculateMetrics() {
    const metrics = {};

    for (const [strategy, data] of Object.entries(this.results)) {
      if (data.total === 0) {
        metrics[strategy] = { winRate: 0, profitFactor: 0, avgProfit: 0, totalTrades: 0 };
        continue;
      }

      const winRate = (data.wins / data.total) * 100;
      const avgProfit = data.totalProfit / data.total;
      const profitFactor = data.totalProfit > 0 ?
        (data.wins * Math.abs(avgProfit)) / Math.max(1, data.losses * Math.abs(avgProfit)) : 0;

      metrics[strategy] = {
        winRate: winRate.toFixed(1),
        profitFactor: profitFactor.toFixed(2),
        avgProfit: avgProfit.toFixed(2),
        totalTrades: data.total,
        wins: data.wins,
        losses: data.losses
      };
    }

    return metrics;
  }

  // Real-time signal validation
  logSignal(symbol, strategy, signal, entryPrice) {
    this.signalLog.push({
      timestamp: Date.now(),
      symbol,
      strategy,
      action: signal.action,
      confidence: signal.confidence,
      entryPrice,
      outcome: null // Will be filled later
    });
  }

  async validateSignals() {
    const now = Date.now();
    const pending = this.signalLog.filter(s => !s.outcome && now - s.timestamp > 3600000);

    for (const signal of pending) {
      const currentData = await marketData.getSpotPrice(signal.symbol);
      if (currentData) {
        const currentPrice = parseFloat(currentData.lastPrice);
        const priceMove = ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;

        signal.outcome = {
          priceMove: priceMove.toFixed(2),
          correct: (signal.action === 'BUY' && priceMove > 0) ||
                   (signal.action === 'SELL' && priceMove < 0),
          timestamp: now
        };
      }
    }

    return this.getValidationStats();
  }

  getValidationStats() {
    const validated = this.signalLog.filter(s => s.outcome);
    if (validated.length === 0) return null;

    const correct = validated.filter(s => s.outcome.correct).length;
    const winRate = (correct / validated.length) * 100;

    return {
      totalValidated: validated.length,
      correct,
      incorrect: validated.length - correct,
      realAccuracy: winRate.toFixed(1) + '%',
      recentSignals: validated.slice(-10)
    };
  }
}

module.exports = new BacktestingEngine();
