/**
 * Volume Confirmation Filter
 * Validates breakout signals with volume surge
 */

class VolumeConfirmation {
  validateBreakoutVolume(signal, klines, currentVolume) {
    if (!signal.action || signal.action === 'HOLD') {
      return { valid: true, reason: 'Not a breakout signal' };
    }

    // Check if this is a breakout-type signal
    const isBreakout = this.isBreakoutSignal(signal);

    if (!isBreakout) {
      return { valid: true, reason: 'Not a breakout signal' };
    }

    if (!klines || klines.length < 20) {
      return { valid: true, reason: 'Insufficient data' };
    }

    // Calculate average volume over last 20 periods
    const volumes = klines.map(k => parseFloat(k[5]));
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

    // Calculate volume ratios
    const volumeRatio = currentVolume / avgVolume;
    const volumeIncreasePercent = ((currentVolume - avgVolume) / avgVolume) * 100;

    // Breakout requirements
    const minVolumeRatio = 1.5; // 50% above average
    const strongVolumeRatio = 2.0; // 100% above average

    if (volumeRatio < minVolumeRatio) {
      return {
        valid: false,
        reason: `Weak volume: ${volumeRatio.toFixed(2)}x avg (need ${minVolumeRatio}x)`,
        volumeRatio: volumeRatio.toFixed(2),
        volumeIncreasePercent: volumeIncreasePercent.toFixed(1),
        recommendation: 'Wait for volume confirmation'
      };
    } else if (volumeRatio >= strongVolumeRatio) {
      return {
        valid: true,
        reason: `Strong volume surge: ${volumeRatio.toFixed(2)}x avg`,
        volumeRatio: volumeRatio.toFixed(2),
        volumeIncreasePercent: volumeIncreasePercent.toFixed(1),
        quality: 'HIGH',
        confidenceBonus: 1.2 // 20% boost
      };
    } else {
      return {
        valid: true,
        reason: `Adequate volume: ${volumeRatio.toFixed(2)}x avg`,
        volumeRatio: volumeRatio.toFixed(2),
        volumeIncreasePercent: volumeIncreasePercent.toFixed(1),
        quality: 'MEDIUM'
      };
    }
  }

  isBreakoutSignal(signal) {
    if (!signal.reasons || signal.reasons.length === 0) return false;

    const breakoutKeywords = [
      'breakout',
      'break out',
      'resistance',
      'support break',
      'new high',
      'new low',
      'structure break'
    ];

    const reasonsText = signal.reasons.join(' ').toLowerCase();
    return breakoutKeywords.some(keyword => reasonsText.includes(keyword));
  }

  validateSignalVolume(signal, klines, currentVolume, marketStructure) {
    // If market structure indicates breakout, require volume
    if (marketStructure && marketStructure.breakout) {
      return this.validateBreakoutVolume(signal, klines, currentVolume);
    }

    // For trend-following signals, volume should be healthy
    if (signal.action && signal.action !== 'HOLD') {
      if (!klines || klines.length < 10) {
        return { valid: true, reason: 'Insufficient data' };
      }

      const volumes = klines.slice(-10).map(k => parseFloat(k[5]));
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const volumeRatio = currentVolume / avgVolume;

      // Volume declining = weak signal
      if (volumeRatio < 0.7) {
        return {
          valid: true,
          reason: 'Declining volume - reduced confidence',
          volumeRatio: volumeRatio.toFixed(2),
          confidencePenalty: 0.8, // 20% reduction
          warning: 'Volume below average'
        };
      }

      // Volume increasing = stronger signal
      if (volumeRatio > 1.3) {
        return {
          valid: true,
          reason: 'Increasing volume - good confirmation',
          volumeRatio: volumeRatio.toFixed(2),
          confidenceBonus: 1.15 // 15% boost
        };
      }
    }

    return { valid: true, reason: 'Volume acceptable' };
  }

  detectVolumeSpike(klines, currentVolume) {
    if (!klines || klines.length < 20) return null;

    const volumes = klines.map(k => parseFloat(k[5]));
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

    // Calculate standard deviation
    const variance = volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length;
    const stdDev = Math.sqrt(variance);

    const zScore = (currentVolume - avgVolume) / stdDev;

    if (zScore > 2) {
      return {
        spike: true,
        severity: zScore > 3 ? 'EXTREME' : 'HIGH',
        zScore: zScore.toFixed(2),
        volumeRatio: (currentVolume / avgVolume).toFixed(2),
        interpretation: 'Significant institutional activity'
      };
    }

    return null;
  }
}

module.exports = new VolumeConfirmation();
