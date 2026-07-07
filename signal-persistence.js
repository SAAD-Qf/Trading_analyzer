/**
 * Signal Persistence Tracker - Anti-Flicker System
 * Only confirms signals that persist for 2-3 cycles
 */

class SignalPersistence {
  constructor() {
    this.signalHistory = new Map(); // symbol -> array of recent signals
    this.maxHistory = 3; // Track last 3 signals
  }

  trackSignal(symbol, signal) {
    if (!this.signalHistory.has(symbol)) {
      this.signalHistory.set(symbol, []);
    }

    const history = this.signalHistory.get(symbol);
    history.push({
      action: signal.action,
      confidence: signal.confidence,
      score: signal.score,
      timestamp: Date.now()
    });

    // Keep only last 3 signals
    if (history.length > this.maxHistory) {
      history.shift();
    }
  }

  isSignalPersistent(symbol, currentSignal) {
    const history = this.signalHistory.get(symbol);

    if (!history || history.length < 2) {
      return {
        persistent: false,
        reason: 'Insufficient history (new signal)',
        confidence: 'LOW'
      };
    }

    // Check if last 2-3 signals agree
    const recentSignals = history.slice(-2);
    const allAgree = recentSignals.every(s => {
      // Same direction (BUY/SELL)
      const sameDirection = (
        (s.action.includes('BUY') && currentSignal.action.includes('BUY')) ||
        (s.action.includes('SELL') && currentSignal.action.includes('SELL')) ||
        (s.action === 'HOLD' && currentSignal.action === 'HOLD')
      );
      return sameDirection;
    });

    if (allAgree) {
      // Signal has persisted - high confidence
      const avgScore = recentSignals.reduce((sum, s) => sum + parseFloat(s.score || 0), 0) / recentSignals.length;

      return {
        persistent: true,
        reason: `Signal confirmed across ${recentSignals.length + 1} cycles`,
        confidence: 'HIGH',
        stability: this.calculateStability(recentSignals),
        avgScore
      };
    } else {
      // Signal is flickering
      return {
        persistent: false,
        reason: 'Signal flickering - not stable',
        confidence: 'LOW',
        flickering: true
      };
    }
  }

  calculateStability(signals) {
    if (signals.length < 2) return 0;

    const scores = signals.map(s => parseFloat(s.score || 0));
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = more stable
    const stability = Math.max(0, 100 - (stdDev * 10));
    return stability.toFixed(1);
  }

  shouldTrade(symbol, signal) {
    const persistence = this.isSignalPersistent(symbol, signal);

    // Only trade on persistent signals with BUY/SELL action
    if (signal.action === 'HOLD') return false;
    if (!persistence.persistent) return false;
    if (persistence.confidence === 'LOW') return false;

    return true;
  }

  getSignalQuality(symbol) {
    const history = this.signalHistory.get(symbol);
    if (!history || history.length < 2) return 'UNKNOWN';

    const lastTwo = history.slice(-2);
    const sameDirection = (
      (lastTwo[0].action.includes('BUY') && lastTwo[1].action.includes('BUY')) ||
      (lastTwo[0].action.includes('SELL') && lastTwo[1].action.includes('SELL'))
    );

    if (sameDirection) {
      return 'STABLE';
    } else {
      return 'UNSTABLE';
    }
  }

  clearOldSignals(maxAge = 3600000) {
    const now = Date.now();

    for (const [symbol, history] of this.signalHistory.entries()) {
      const filtered = history.filter(s => now - s.timestamp < maxAge);

      if (filtered.length === 0) {
        this.signalHistory.delete(symbol);
      } else {
        this.signalHistory.set(symbol, filtered);
      }
    }
  }
}

module.exports = new SignalPersistence();
