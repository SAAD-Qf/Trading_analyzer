/**
 * INTEGRATED ANALYZER V2 - WITH ALL 9 ADVANCED MODULES
 * Includes: Multi-TF, Regime, Smart Money, Adaptive, Entry/Exit, Backtesting
 * + Volume Confirmation, BTC Correlation, Signal Persistence
 */

const multiTimeframe = require('./multi-timeframe');
const regimeDetector = require('./regime-detector');
const smartMoneyFlow = require('./smart-money-flow');
const backtestEngine = require('./backtesting-engine');
const entryExitSystem = require('./entry-exit-system');
const adaptiveThresholds = require('./adaptive-thresholds');
const advancedAnalyzer = require('./advanced-analyzer-v3');
const advancedIndicators = require('./advanced-indicators');

// NEW FILTERS
const volumeConfirmation = require('./volume-confirmation');
const btcCorrelationFilter = require('./btc-correlation-filter');
const signalPersistence = require('./signal-persistence');

class IntegratedAnalyzerV2 {
  async analyzeSymbolEnhanced(symbol, marketData) {
    if (!marketData || !marketData.spotPrice) return null;

    const currentPrice = parseFloat(marketData.spotPrice.lastPrice);
    const priceChange24h = parseFloat(marketData.spotPrice.priceChangePercent);
    const volume24h = parseFloat(marketData.spotPrice.volume);

    // Step 1: Get market regime
    const atr = advancedIndicators.calculateATR(marketData.klines1h, 14);
    const regime = regimeDetector.detectRegime(marketData.klines1h, atr);

    // Step 2: Calculate adaptive thresholds based on regime
    const thresholds = adaptiveThresholds.calculateAdaptiveThresholds(
      marketData.klines1h,
      atr,
      regime
    );

    // Step 3: Multi-timeframe confluence check
    const confluence = await multiTimeframe.analyzeSymbol(symbol);

    // Step 4: Smart money flow analysis
    const smartMoney = marketData.recentTrades ?
      smartMoneyFlow.analyzeTradeFlow(marketData.recentTrades) : null;

    // Step 5: Generate base analysis
    const baseAnalysis = await this.generateBaseAnalysis(marketData);

    // Step 6: Calculate adjusted scores
    const adjustedSignals = this.calculateAdjustedSignals(
      baseAnalysis,
      regime,
      confluence,
      smartMoney,
      thresholds
    );

    // Step 7: Track signal persistence
    signalPersistence.trackSignal(symbol, adjustedSignals.primary);
    const persistence = signalPersistence.isSignalPersistent(symbol, adjustedSignals.primary);

    // Step 8: BTC correlation filter
    const btcFilter = await btcCorrelationFilter.shouldAllowSignal(symbol, adjustedSignals.primary);

    // Step 9: Volume confirmation
    const volumeCheck = volumeConfirmation.validateSignalVolume(
      adjustedSignals.primary,
      marketData.klines1h,
      volume24h,
      baseAnalysis.marketStructure
    );

    // Step 10: Apply all filters and calculate final signal
    const finalSignal = this.applyFilters(
      adjustedSignals,
      persistence,
      btcFilter,
      volumeCheck,
      regime,
      confluence
    );

    // Step 11: Generate entry/exit if signal is valid
    let entryExit = null;
    if (finalSignal.primary && finalSignal.primary.action !== 'HOLD') {
      entryExit = this.generateEntryExitPoints(
        finalSignal,
        currentPrice,
        atr,
        regime,
        baseAnalysis.footprint,
        baseAnalysis.volumeProfile
      );
    }

    // Step 12: Log signal for validation
    if (finalSignal.primary && finalSignal.primary.action !== 'HOLD') {
      backtestEngine.logSignal(
        symbol,
        finalSignal.primary.type,
        finalSignal.primary,
        currentPrice
      );
    }

    return {
      symbol,
      price: currentPrice,
      priceChange24h,
      volume24h,
      regime,
      confluence,
      smartMoney,
      thresholds,
      baseAnalysis,
      signals: finalSignal,
      entryExit,
      filters: {
        persistence,
        btcCorrelation: btcFilter,
        volumeConfirmation: volumeCheck
      },
      realAccuracy: this.estimateRealAccuracy(
        finalSignal,
        regime,
        confluence,
        smartMoney,
        persistence,
        btcFilter,
        volumeCheck
      ),
      timestamp: Date.now()
    };
  }

  async generateBaseAnalysis(data) {
    const closes1h = data.klines1h.map(k => parseFloat(k[4]));
    const closes4h = data.klines4h.map(k => parseFloat(k[4]));
    const currentPrice = closes1h[closes1h.length - 1];

    const rsi = advancedAnalyzer.calculateRSI(closes1h, 14);
    const ema20 = advancedAnalyzer.calculateEMA(closes1h, 20);
    const ema50 = advancedAnalyzer.calculateEMA(closes1h, 50);
    const ema200 = advancedAnalyzer.calculateEMA(closes4h, 200);
    const macd = advancedAnalyzer.calculateMACD(closes1h);
    const vwap = advancedIndicators.calculateVWAP(data.klines1h);
    const atr = advancedIndicators.calculateATR(data.klines1h, 14);
    const volumeProfile = advancedIndicators.calculateVolumeProfile(data.klines4h, 20);
    const orderImbalance = advancedIndicators.calculateOrderImbalance(data.orderBook, 10);
    const candlePatterns = advancedIndicators.detectCandlePatterns(data.klines1h);
    const obv = advancedIndicators.calculateOBV(data.klines1h);
    const marketStructure = advancedIndicators.detectMarketStructure(data.klines4h, 5);
    const cvd = advancedAnalyzer.calculateCVD(data.recentTrades);
    const footprint = advancedAnalyzer.analyzeFootprint(data.recentTrades, currentPrice);

    return {
      price: currentPrice,
      rsi, ema20, ema50, ema200, macd,
      vwap, atr, volumeProfile, orderImbalance,
      candlePatterns, obv, marketStructure, cvd, footprint
    };
  }

  calculateAdjustedSignals(base, regime, confluence, smartMoney, thresholds) {
    let scalpScore = 0, intradayScore = 0, swingScore = 0;
    const reasons = { scalp: [], intraday: [], swing: [] };

    // RSI with adaptive thresholds
    if (base.rsi < thresholds.rsi.oversold) {
      intradayScore += 2.5;
      swingScore += 2;
      reasons.intraday.push(`RSI oversold (${base.rsi.toFixed(1)})`);
    } else if (base.rsi > thresholds.rsi.overbought) {
      intradayScore -= 2.5;
      swingScore -= 2;
      reasons.intraday.push(`RSI overbought (${base.rsi.toFixed(1)})`);
    }

    // EMA trend
    if (base.price > base.ema20 && base.ema20 > base.ema50) {
      intradayScore += 2;
      swingScore += 2;
      reasons.intraday.push('Bullish EMA alignment');
    } else if (base.price < base.ema20 && base.ema20 < base.ema50) {
      intradayScore -= 2;
      swingScore -= 2;
      reasons.intraday.push('Bearish EMA alignment');
    }

    // MACD
    if (base.macd && base.macd.crossover) {
      const weight = base.macd.bullish ? 2 : -2;
      intradayScore += weight;
      reasons.intraday.push(`MACD ${base.macd.bullish ? 'bullish' : 'bearish'} cross`);
    }

    // Order imbalance
    if (base.orderImbalance) {
      if (base.orderImbalance.imbalance > thresholds.orderImbalance.strong) {
        scalpScore += 2.5;
        reasons.scalp.push(`Order imbalance: ${base.orderImbalance.imbalance.toFixed(1)}%`);
      } else if (base.orderImbalance.imbalance < -thresholds.orderImbalance.strong) {
        scalpScore -= 2.5;
        reasons.scalp.push(`Order imbalance: ${base.orderImbalance.imbalance.toFixed(1)}%`);
      }
    }

    // Smart money flow (MAJOR WEIGHT)
    if (smartMoney) {
      if (smartMoney.signal === 'STRONG_BUY') {
        scalpScore += 3;
        intradayScore += 2.5;
        swingScore += 2;
        reasons.scalp.push('Smart money accumulation');
      } else if (smartMoney.signal === 'STRONG_SELL') {
        scalpScore -= 3;
        intradayScore -= 2.5;
        swingScore -= 2;
        reasons.scalp.push('Smart money distribution');
      }
    }

    // Market structure
    if (base.marketStructure) {
      if (base.marketStructure.breakout === 'BULLISH_BREAKOUT') {
        swingScore += 3;
        reasons.swing.push('Bullish breakout');
      } else if (base.marketStructure.breakout === 'BEARISH_BREAKOUT') {
        swingScore -= 3;
        reasons.swing.push('Bearish breakout');
      }
    }

    // Apply regime adjustments
    if (regime && regime.signalAdjustment) {
      scalpScore = adaptiveThresholds.adjustSignalScore(scalpScore, regime, confluence);
      intradayScore = adaptiveThresholds.adjustSignalScore(intradayScore, regime, confluence);
      swingScore = adaptiveThresholds.adjustSignalScore(swingScore, regime, confluence);
    }

    // Confluence filter
    if (confluence && !confluence.aligned) {
      scalpScore *= 0.5;
      intradayScore *= 0.5;
      swingScore *= 0.5;
      reasons.intraday.push('⚠️ Timeframes not aligned');
    } else if (confluence && confluence.aligned) {
      reasons.intraday.push(`✓ ${confluence.strength.toFixed(0)}% timeframe alignment`);
    }

    return {
      scalping: this.formatSignal(scalpScore, reasons.scalp, 'SCALPING', thresholds),
      intraday: this.formatSignal(intradayScore, reasons.intraday, 'INTRADAY', thresholds),
      swing: this.formatSignal(swingScore, reasons.swing, 'SWING', thresholds),
      primary: this.selectPrimarySignal(scalpScore, intradayScore, swingScore, confluence, regime)
    };
  }

  applyFilters(signals, persistence, btcFilter, volumeCheck, regime, confluence) {
    let finalSignal = JSON.parse(JSON.stringify(signals)); // Deep copy
    const filterReasons = [];

    // Filter 1: Signal Persistence
    if (!persistence.persistent && signals.primary.action !== 'HOLD') {
      filterReasons.push(`⚠️ ${persistence.reason}`);
      finalSignal.primary.confidence = 'LOW';

      // If signal is flickering, downgrade to HOLD
      if (persistence.flickering) {
        finalSignal.primary.action = 'HOLD';
        filterReasons.push('❌ Signal flickering - REJECTED');
      }
    } else if (persistence.persistent) {
      filterReasons.push(`✓ Signal stable (${persistence.reason})`);
      // Boost confidence for persistent signals
      if (finalSignal.primary.confidence === 'MEDIUM') {
        finalSignal.primary.confidence = 'HIGH';
      }
    }

    // Filter 2: BTC Correlation
    if (!btcFilter.allowed) {
      finalSignal.primary.action = 'HOLD';
      filterReasons.push(`❌ BTC Filter: ${btcFilter.reason}`);
    } else if (btcFilter.confidencePenalty) {
      filterReasons.push(`⚠️ ${btcFilter.warning || btcFilter.reason}`);
      if (finalSignal.primary.confidence === 'HIGH') {
        finalSignal.primary.confidence = 'MEDIUM';
      } else if (finalSignal.primary.confidence === 'MEDIUM') {
        finalSignal.primary.confidence = 'LOW';
      }
    } else if (btcFilter.confidenceBonus) {
      filterReasons.push(`✓ ${btcFilter.btcContext}`);
    }

    // Filter 3: Volume Confirmation
    if (!volumeCheck.valid) {
      filterReasons.push(`❌ Volume: ${volumeCheck.reason}`);
      finalSignal.primary.action = 'HOLD';
    } else if (volumeCheck.confidencePenalty) {
      filterReasons.push(`⚠️ ${volumeCheck.warning || volumeCheck.reason}`);
      if (finalSignal.primary.confidence === 'HIGH') {
        finalSignal.primary.confidence = 'MEDIUM';
      }
    } else if (volumeCheck.confidenceBonus) {
      filterReasons.push(`✓ ${volumeCheck.reason}`);
    }

    // Add filter reasons to primary signal
    finalSignal.primary.filterReasons = filterReasons;
    finalSignal.filtersApplied = {
      persistence: persistence.persistent,
      btcCorrelation: btcFilter.allowed,
      volumeConfirmation: volumeCheck.valid
    };

    return finalSignal;
  }

  formatSignal(score, reasons, type, thresholds) {
    const strong = thresholds.signalStrength.strong;
    const medium = thresholds.signalStrength.medium;

    let action = 'HOLD';
    let confidence = 'LOW';

    if (score >= strong) {
      action = 'STRONG BUY';
      confidence = 'HIGH';
    } else if (score >= medium) {
      action = 'BUY';
      confidence = 'MEDIUM';
    } else if (score <= -strong) {
      action = 'STRONG SELL';
      confidence = 'HIGH';
    } else if (score <= -medium) {
      action = 'SELL';
      confidence = 'MEDIUM';
    }

    return {
      type,
      action,
      confidence,
      score: score.toFixed(2),
      reasons: reasons.slice(0, 5),
      timeframe: type === 'SCALPING' ? '5m' : type === 'INTRADAY' ? '15m-1h' : '4h'
    };
  }

  selectPrimarySignal(scalpScore, intradayScore, swingScore, confluence, regime) {
    const scores = [
      { score: Math.abs(intradayScore), type: 'INTRADAY', raw: intradayScore },
      { score: Math.abs(swingScore), type: 'SWING', raw: swingScore },
      { score: Math.abs(scalpScore), type: 'SCALPING', raw: scalpScore }
    ];

    scores.sort((a, b) => b.score - a.score);
    const primary = scores[0];

    return {
      type: primary.type,
      action: primary.raw >= 4 ? 'BUY' : primary.raw <= -4 ? 'SELL' : 'HOLD',
      score: primary.raw,
      confidence: Math.abs(primary.raw) >= 7 ? 'HIGH' :
                  Math.abs(primary.raw) >= 4 ? 'MEDIUM' : 'LOW'
    };
  }

  generateEntryExitPoints(signals, currentPrice, atr, regime, footprint, volumeProfile) {
    const entries = {};

    ['scalping', 'intraday', 'swing'].forEach(strategy => {
      const signal = signals[strategy];
      if (signal && signal.action !== 'HOLD') {
        entries[strategy] = entryExitSystem.calculatePerfectEntry(
          signal,
          currentPrice,
          atr,
          regime,
          footprint,
          volumeProfile
        );
      }
    });

    return entries;
  }

  estimateRealAccuracy(signals, regime, confluence, smartMoney, persistence, btcFilter, volumeCheck) {
    let baseAccuracy = 55;

    // Confluence boost
    if (confluence && confluence.aligned) {
      baseAccuracy += 10;
    }

    // Regime confidence
    if (regime && regime.confidence === 'HIGH') {
      baseAccuracy += 5;
    } else if (regime && regime.confidence === 'LOW') {
      baseAccuracy -= 5;
    }

    // Smart money confirmation
    if (smartMoney && (smartMoney.signal === 'STRONG_BUY' || smartMoney.signal === 'STRONG_SELL')) {
      baseAccuracy += 8;
    }

    // Signal persistence (NEW)
    if (persistence && persistence.persistent) {
      baseAccuracy += 8;
    } else if (persistence && persistence.flickering) {
      baseAccuracy -= 10;
    }

    // BTC correlation (NEW)
    if (btcFilter && btcFilter.confidenceBonus) {
      baseAccuracy += 5;
    } else if (btcFilter && btcFilter.confidencePenalty) {
      baseAccuracy -= 8;
    }

    // Volume confirmation (NEW)
    if (volumeCheck && volumeCheck.confidenceBonus) {
      baseAccuracy += 5;
    } else if (volumeCheck && volumeCheck.confidencePenalty) {
      baseAccuracy -= 5;
    }

    // Signal strength
    const primary = signals.primary;
    if (primary && primary.confidence === 'HIGH') {
      baseAccuracy += 7;
    } else if (primary && primary.confidence === 'LOW') {
      baseAccuracy -= 10;
    }

    return Math.min(78, Math.max(45, baseAccuracy));
  }
}

module.exports = new IntegratedAnalyzerV2();
