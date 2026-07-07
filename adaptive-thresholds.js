/**
 * Adaptive Dynamic Thresholds System
 */

class AdaptiveThresholds {
  calculateAdaptiveThresholds(klines, atr, regime) {
    if (!klines || !atr) return this.getDefaultThresholds();

    const volatility = atr.percent;
    const closes = klines.map(k => parseFloat(k[4]));
    const currentPrice = closes[closes.length - 1];

    // Base thresholds
    let thresholds = {
      rsi: {
        oversold: 35,
        overbought: 65
      },
      orderImbalance: {
        strong: 70,
        extreme: 80
      },
      stopLoss: {
        scalping: 0.015,
        intraday: 0.025,
        swing: 0.04
      },
      takeProfit: {
        scalping: 0.03,
        intraday: 0.05,
        swing: 0.10
      },
      volumeMultiplier: 1.2,
      signalStrength: {
        weak: 2,
        medium: 4,
        strong: 7
      }
    };

    // Volatility-based adjustments
    if (volatility > 3) {
      // High volatility
      thresholds.rsi.oversold = 25;
      thresholds.rsi.overbought = 75;
      thresholds.orderImbalance.strong = 75;
      thresholds.orderImbalance.extreme = 85;
      thresholds.stopLoss.scalping = 0.025;
      thresholds.stopLoss.intraday = 0.04;
      thresholds.stopLoss.swing = 0.06;
      thresholds.signalStrength.strong = 9;
    } else if (volatility < 1.5) {
      // Low volatility
      thresholds.rsi.oversold = 40;
      thresholds.rsi.overbought = 60;
      thresholds.orderImbalance.strong = 60;
      thresholds.stopLoss.scalping = 0.01;
      thresholds.stopLoss.intraday = 0.02;
      thresholds.stopLoss.swing = 0.03;
      thresholds.signalStrength.strong = 6;
    }

    // Regime-based adjustments
    if (regime) {
      if (regime.regime === 'TRENDING_BULL' || regime.regime === 'TRENDING_BEAR') {
        thresholds.signalStrength.weak = 3;
        thresholds.takeProfit.scalping = 0.04;
        thresholds.takeProfit.intraday = 0.07;
        thresholds.takeProfit.swing = 0.15;
      } else if (regime.regime === 'RANGING') {
        thresholds.signalStrength.medium = 5;
        thresholds.signalStrength.strong = 8;
        thresholds.takeProfit.scalping = 0.02;
        thresholds.takeProfit.intraday = 0.03;
      } else if (regime.regime === 'HIGH_VOLATILITY') {
        thresholds.signalStrength.strong = 10;
        thresholds.volumeMultiplier = 1.5;
      }
    }

    // ATR-based stop loss and take profit
    const atrMultiplier = {
      stopLoss: 2.5,
      takeProfit: 5
    };

    thresholds.atrBased = {
      stopLossLong: currentPrice - (atr.value * atrMultiplier.stopLoss),
      stopLossShort: currentPrice + (atr.value * atrMultiplier.stopLoss),
      takeProfitLong: currentPrice + (atr.value * atrMultiplier.takeProfit),
      takeProfitShort: currentPrice - (atr.value * atrMultiplier.takeProfit),
      stopLossPercent: ((atr.value * atrMultiplier.stopLoss) / currentPrice) * 100,
      takeProfitPercent: ((atr.value * atrMultiplier.takeProfit) / currentPrice) * 100
    };

    return thresholds;
  }

  getDefaultThresholds() {
    return {
      rsi: { oversold: 35, overbought: 65 },
      orderImbalance: { strong: 70, extreme: 80 },
      stopLoss: { scalping: 0.015, intraday: 0.025, swing: 0.04 },
      takeProfit: { scalping: 0.03, intraday: 0.05, swing: 0.10 },
      volumeMultiplier: 1.2,
      signalStrength: { weak: 2, medium: 4, strong: 7 }
    };
  }

  adjustSignalScore(score, regime, confluence) {
    if (!regime) return score;

    const adjustment = regime.signalAdjustment || {};
    let adjusted = score;

    // Apply regime multipliers
    if (score > 0) {
      adjusted *= (adjustment.momentum || 1);
    } else {
      adjusted *= (adjustment.momentum || 1);
    }

    // Confluence bonus
    if (confluence && confluence.aligned) {
      adjusted *= 1.3;
    }

    // Regime confidence penalty
    if (regime.confidence === 'LOW') {
      adjusted *= 0.7;
    }

    return adjusted;
  }
}

module.exports = new AdaptiveThresholds();
