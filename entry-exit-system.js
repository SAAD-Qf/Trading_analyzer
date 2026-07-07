/**
 * Enhanced Entry/Exit System with Precise SL/TP
 */

class EntryExitSystem {
  calculatePerfectEntry(signal, currentPrice, atr, regime, footprint, volumeProfile) {
    if (!signal || !currentPrice || !atr) return null;

    const entry = {
      action: signal.action,
      strategy: signal.type,
      currentPrice,
      entryPrice: currentPrice,
      stopLoss: null,
      takeProfit: null,
      riskReward: null,
      positionSize: 0.02,
      confidence: signal.confidence,
      reasons: []
    };

    // Determine entry refinement based on footprint
    if (footprint && footprint.pointOfControl) {
      const poc = footprint.pointOfControl.price;
      const distanceToPOC = Math.abs((currentPrice - poc) / currentPrice) * 100;

      if (distanceToPOC < 0.3) {
        entry.reasons.push(`Near POC support/resistance at $${poc.toFixed(2)}`);
        entry.confidence = 'HIGH';
      }
    }

    // Volume profile entry refinement
    if (volumeProfile) {
      if (volumeProfile.position === 'ABOVE_VALUE' && signal.action === 'STRONG BUY') {
        entry.reasons.push('Price above value area - continuation likely');
      } else if (volumeProfile.position === 'BELOW_VALUE' && signal.action === 'STRONG SELL') {
        entry.reasons.push('Price below value area - continuation likely');
      } else if (volumeProfile.position === 'IN_VALUE') {
        entry.confidence = 'MEDIUM';
        entry.reasons.push('Inside value area - wait for breakout');
      }
    }

    // Calculate stop loss and take profit
    const sltp = this.calculateSLTP(currentPrice, atr, signal, regime);
    entry.stopLoss = sltp.stopLoss;
    entry.takeProfit = sltp.takeProfit;
    entry.stopLossPercent = sltp.stopLossPercent;
    entry.takeProfitPercent = sltp.takeProfitPercent;
    entry.riskReward = sltp.riskReward;

    // Adjust position size based on volatility and confidence
    entry.positionSize = this.calculatePositionSize(atr, regime, signal.confidence);

    // Entry timing
    entry.timing = this.getEntryTiming(signal.type, regime);

    return entry;
  }

  calculateSLTP(price, atr, signal, regime) {
    const isLong = signal.action.includes('BUY');

    // Base ATR multipliers
    let slMultiplier = 2.5;
    let tpMultiplier = 5;

    // Adjust based on strategy
    if (signal.type === 'SCALPING') {
      slMultiplier = 2;
      tpMultiplier = 4;
    } else if (signal.type === 'SWING') {
      slMultiplier = 3;
      tpMultiplier = 7;
    }

    // Adjust based on regime
    if (regime && regime.regime === 'HIGH_VOLATILITY') {
      slMultiplier *= 1.5;
      tpMultiplier *= 1.5;
    } else if (regime && regime.regime.includes('TRENDING')) {
      tpMultiplier *= 1.3; // Wider targets in trends
    }

    // Adjust based on signal strength
    if (signal.action.includes('STRONG')) {
      tpMultiplier *= 1.2;
    }

    const slDistance = atr.value * slMultiplier;
    const tpDistance = atr.value * tpMultiplier;

    let stopLoss, takeProfit;

    if (isLong) {
      stopLoss = price - slDistance;
      takeProfit = price + tpDistance;
    } else {
      stopLoss = price + slDistance;
      takeProfit = price - tpDistance;
    }

    const stopLossPercent = (slDistance / price) * 100;
    const takeProfitPercent = (tpDistance / price) * 100;
    const riskReward = takeProfitPercent / stopLossPercent;

    return {
      stopLoss: stopLoss.toFixed(2),
      takeProfit: takeProfit.toFixed(2),
      stopLossPercent: stopLossPercent.toFixed(2),
      takeProfitPercent: takeProfitPercent.toFixed(2),
      riskReward: riskReward.toFixed(2)
    };
  }

  calculatePositionSize(atr, regime, confidence) {
    let baseSize = 0.02; // 2% of portfolio

    // Reduce size in high volatility
    if (atr.percent > 3) {
      baseSize *= 0.6;
    } else if (atr.percent > 2) {
      baseSize *= 0.8;
    }

    // Reduce size in uncertain regimes
    if (regime && regime.regime === 'RANGING') {
      baseSize *= 0.7;
    } else if (regime && regime.regime === 'HIGH_VOLATILITY') {
      baseSize *= 0.5;
    }

    // Adjust based on confidence
    if (confidence === 'HIGH') {
      baseSize *= 1.2;
    } else if (confidence === 'LOW') {
      baseSize *= 0.6;
    }

    return Math.min(0.05, Math.max(0.005, baseSize)); // Cap between 0.5% and 5%
  }

  getEntryTiming(strategy, regime) {
    const timing = {
      immediate: false,
      waitForConfirmation: false,
      recommendation: ''
    };

    if (strategy === 'SCALPING') {
      timing.immediate = true;
      timing.recommendation = 'Enter immediately on 5m confirmation';
    } else if (strategy === 'INTRADAY') {
      if (regime && regime.regime === 'RANGING') {
        timing.waitForConfirmation = true;
        timing.recommendation = 'Wait for breakout confirmation';
      } else {
        timing.immediate = true;
        timing.recommendation = 'Enter on 15m close';
      }
    } else if (strategy === 'SWING') {
      timing.waitForConfirmation = true;
      timing.recommendation = 'Wait for 4h close confirmation';
    }

    return timing;
  }

  // Trailing stop logic
  calculateTrailingStop(entryPrice, currentPrice, atr, isLong) {
    const atrDistance = atr.value * 2;

    if (isLong) {
      const trailingStop = currentPrice - atrDistance;
      return Math.max(trailingStop, entryPrice - (atr.value * 2.5));
    } else {
      const trailingStop = currentPrice + atrDistance;
      return Math.min(trailingStop, entryPrice + (atr.value * 2.5));
    }
  }

  // Exit conditions
  shouldExit(entry, currentPrice, currentSignal, timeSinceEntry) {
    const exitReasons = [];

    // Take profit hit
    if (entry.action === 'BUY' && currentPrice >= parseFloat(entry.takeProfit)) {
      exitReasons.push('Take profit reached');
    }
    if (entry.action === 'SELL' && currentPrice <= parseFloat(entry.takeProfit)) {
      exitReasons.push('Take profit reached');
    }

    // Stop loss hit
    if (entry.action === 'BUY' && currentPrice <= parseFloat(entry.stopLoss)) {
      exitReasons.push('Stop loss hit');
    }
    if (entry.action === 'SELL' && currentPrice >= parseFloat(entry.stopLoss)) {
      exitReasons.push('Stop loss hit');
    }

    // Signal reversal
    if (currentSignal) {
      if (entry.action === 'BUY' && currentSignal.action.includes('SELL')) {
        exitReasons.push('Signal reversal detected');
      }
      if (entry.action === 'SELL' && currentSignal.action.includes('BUY')) {
        exitReasons.push('Signal reversal detected');
      }
    }

    // Time-based exit for scalping
    if (entry.strategy === 'SCALPING' && timeSinceEntry > 3600000) {
      exitReasons.push('Scalping time limit (1h) reached');
    }

    return {
      shouldExit: exitReasons.length > 0,
      reasons: exitReasons
    };
  }
}

module.exports = new EntryExitSystem();
