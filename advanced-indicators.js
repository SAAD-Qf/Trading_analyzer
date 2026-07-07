/**
 * Advanced Indicators Module
 * Implements all professional trading indicators for maximum accuracy
 */

class AdvancedIndicators {
  // ==================== VWAP (Volume Weighted Average Price) ====================

  calculateVWAP(klines) {
    if (!klines || klines.length === 0) return null;

    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (const kline of klines) {
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);

      const typicalPrice = (high + low + close) / 3;
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }

    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
    const currentPrice = parseFloat(klines[klines.length - 1][4]);

    return {
      value: vwap,
      signal: currentPrice > vwap ? 'BULLISH' : 'BEARISH',
      deviation: vwap ? ((currentPrice - vwap) / vwap) * 100 : 0,
      strength: vwap ? Math.abs((currentPrice - vwap) / vwap) * 100 : 0
    };
  }

  // ==================== ATR (Average True Range) ====================

  calculateATR(klines, period = 14) {
    if (!klines || klines.length < period + 1) return null;

    const trueRanges = [];

    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i][2]);
      const low = parseFloat(klines[i][3]);
      const prevClose = parseFloat(klines[i - 1][4]);

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Calculate initial ATR (SMA of first 'period' TRs)
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

    // Calculate smoothed ATR
    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }

    const currentPrice = parseFloat(klines[klines.length - 1][4]);
    const atrPercent = (atr / currentPrice) * 100;

    return {
      value: atr,
      percent: atrPercent,
      stopLossLong: currentPrice - (atr * 2),
      stopLossShort: currentPrice + (atr * 2),
      takeProfitLong: currentPrice + (atr * 3),
      takeProfitShort: currentPrice - (atr * 3),
      volatility: atrPercent > 3 ? 'HIGH' : atrPercent > 1.5 ? 'MEDIUM' : 'LOW'
    };
  }

  // ==================== Volume Profile ====================

  calculateVolumeProfile(klines, bins = 20) {
    if (!klines || klines.length === 0) return null;

    const prices = klines.map(k => parseFloat(k[4]));
    const volumes = klines.map(k => parseFloat(k[5]));

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const binSize = priceRange / bins;

    // Create price bins
    const profile = new Array(bins).fill(0).map((_, i) => ({
      priceLevel: minPrice + (i * binSize) + (binSize / 2),
      volume: 0
    }));

    // Distribute volume into bins
    klines.forEach(kline => {
      const price = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);
      const binIndex = Math.min(Math.floor((price - minPrice) / binSize), bins - 1);
      if (binIndex >= 0) {
        profile[binIndex].volume += volume;
      }
    });

    // Find Point of Control (POC) - highest volume level
    const poc = profile.reduce((max, bin) => bin.volume > max.volume ? bin : max, profile[0]);

    // Find Value Area (70% of volume)
    const totalVolume = profile.reduce((sum, bin) => sum + bin.volume, 0);
    const targetVolume = totalVolume * 0.7;

    const sortedProfile = [...profile].sort((a, b) => b.volume - a.volume);
    let accumulatedVolume = 0;
    const valueAreaLevels = [];

    for (const bin of sortedProfile) {
      accumulatedVolume += bin.volume;
      valueAreaLevels.push(bin.priceLevel);
      if (accumulatedVolume >= targetVolume) break;
    }

    const valueAreaHigh = Math.max(...valueAreaLevels);
    const valueAreaLow = Math.min(...valueAreaLevels);
    const currentPrice = parseFloat(klines[klines.length - 1][4]);

    return {
      poc: poc.priceLevel,
      valueAreaHigh,
      valueAreaLow,
      profile: profile.sort((a, b) => b.volume - a.volume).slice(0, 5),
      position: currentPrice > valueAreaHigh ? 'ABOVE_VALUE' :
                currentPrice < valueAreaLow ? 'BELOW_VALUE' : 'IN_VALUE',
      signal: currentPrice > poc.priceLevel ? 'BULLISH' : 'BEARISH'
    };
  }

  // ==================== Order Book Imbalance ====================

  calculateOrderImbalance(orderBook, depth = 10) {
    if (!orderBook || !orderBook.bids || !orderBook.asks) return null;

    const bids = orderBook.bids.slice(0, depth);
    const asks = orderBook.asks.slice(0, depth);

    const bidVolume = bids.reduce((sum, b) => sum + parseFloat(b[1]), 0);
    const askVolume = asks.reduce((sum, a) => sum + parseFloat(a[1]), 0);

    const totalVolume = bidVolume + askVolume;
    const imbalance = totalVolume > 0 ? (bidVolume - askVolume) / totalVolume : 0;
    const imbalancePercent = imbalance * 100;

    let signal = 'NEUTRAL';
    let strength = 'LOW';

    if (Math.abs(imbalancePercent) > 70) {
      signal = imbalancePercent > 0 ? 'STRONG_BUY' : 'STRONG_SELL';
      strength = 'HIGH';
    } else if (Math.abs(imbalancePercent) > 50) {
      signal = imbalancePercent > 0 ? 'BUY' : 'SELL';
      strength = 'MEDIUM';
    }

    return {
      bidVolume,
      askVolume,
      imbalance: imbalancePercent,
      signal,
      strength,
      pressure: imbalancePercent > 0 ? 'BUY_PRESSURE' : 'SELL_PRESSURE'
    };
  }

  // ==================== Price Action Patterns ====================

  detectCandlePatterns(klines) {
    if (!klines || klines.length < 3) return { patterns: [], signal: 'NEUTRAL' };

    const patterns = [];
    const len = klines.length;

    // Get last 3 candles
    const candles = klines.slice(-3).map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    const current = candles[2];
    const prev = candles[1];
    const prevPrev = candles[0];

    const currentBody = Math.abs(current.close - current.open);
    const currentRange = current.high - current.low;
    const prevBody = Math.abs(prev.close - prev.open);
    const prevRange = prev.high - prev.low;

    // Bullish Engulfing
    if (prev.close < prev.open && // Previous bearish
        current.close > current.open && // Current bullish
        current.open < prev.close && // Opens below previous close
        current.close > prev.open && // Closes above previous open
        currentBody > prevBody * 1.2) {
      patterns.push({ name: 'BULLISH_ENGULFING', weight: 3, signal: 'BUY' });
    }

    // Bearish Engulfing
    if (prev.close > prev.open && // Previous bullish
        current.close < current.open && // Current bearish
        current.open > prev.close && // Opens above previous close
        current.close < prev.open && // Closes below previous open
        currentBody > prevBody * 1.2) {
      patterns.push({ name: 'BEARISH_ENGULFING', weight: 3, signal: 'SELL' });
    }

    // Hammer (bullish reversal)
    const lowerShadow = Math.min(current.open, current.close) - current.low;
    const upperShadow = current.high - Math.max(current.open, current.close);
    if (lowerShadow > currentBody * 2 && upperShadow < currentBody * 0.5 && prev.close < prev.open) {
      patterns.push({ name: 'HAMMER', weight: 2.5, signal: 'BUY' });
    }

    // Shooting Star (bearish reversal)
    if (upperShadow > currentBody * 2 && lowerShadow < currentBody * 0.5 && prev.close > prev.open) {
      patterns.push({ name: 'SHOOTING_STAR', weight: 2.5, signal: 'SELL' });
    }

    // Doji (indecision)
    if (currentBody < currentRange * 0.1) {
      patterns.push({ name: 'DOJI', weight: 1, signal: 'NEUTRAL' });
    }

    // Three White Soldiers (strong bullish)
    if (candles.every(c => c.close > c.open) &&
        current.close > prev.close && prev.close > prevPrev.close) {
      patterns.push({ name: 'THREE_WHITE_SOLDIERS', weight: 4, signal: 'BUY' });
    }

    // Three Black Crows (strong bearish)
    if (candles.every(c => c.close < c.open) &&
        current.close < prev.close && prev.close < prevPrev.close) {
      patterns.push({ name: 'THREE_BLACK_CROWS', weight: 4, signal: 'SELL' });
    }

    // Determine overall signal
    let totalWeight = 0;
    let bullishWeight = 0;
    let bearishWeight = 0;

    patterns.forEach(p => {
      totalWeight += p.weight;
      if (p.signal === 'BUY') bullishWeight += p.weight;
      if (p.signal === 'SELL') bearishWeight += p.weight;
    });

    let overallSignal = 'NEUTRAL';
    if (bullishWeight > bearishWeight && bullishWeight > 2) overallSignal = 'BULLISH';
    if (bearishWeight > bullishWeight && bearishWeight > 2) overallSignal = 'BEARISH';

    return {
      patterns,
      count: patterns.length,
      signal: overallSignal,
      strength: totalWeight,
      bullishWeight,
      bearishWeight
    };
  }

  // ==================== OBV (On-Balance Volume) ====================

  calculateOBV(klines) {
    if (!klines || klines.length < 2) return null;

    let obv = 0;
    const obvValues = [0];

    for (let i = 1; i < klines.length; i++) {
      const currentClose = parseFloat(klines[i][4]);
      const prevClose = parseFloat(klines[i - 1][4]);
      const volume = parseFloat(klines[i][5]);

      if (currentClose > prevClose) {
        obv += volume;
      } else if (currentClose < prevClose) {
        obv -= volume;
      }
      obvValues.push(obv);
    }

    // Detect divergence (simplified)
    const recentOBV = obvValues.slice(-10);
    const obvTrend = recentOBV[recentOBV.length - 1] - recentOBV[0];

    const recentPrices = klines.slice(-10).map(k => parseFloat(k[4]));
    const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[0];

    let divergence = 'NONE';
    if (priceTrend > 0 && obvTrend < 0) divergence = 'BEARISH'; // Price up, OBV down
    if (priceTrend < 0 && obvTrend > 0) divergence = 'BULLISH'; // Price down, OBV up

    return {
      value: obv,
      trend: obvTrend > 0 ? 'RISING' : obvTrend < 0 ? 'FALLING' : 'FLAT',
      divergence,
      signal: divergence !== 'NONE' ? divergence : (obvTrend > 0 ? 'BULLISH' : 'BEARISH')
    };
  }

  // ==================== Fibonacci Retracement ====================

  calculateFibonacci(klines, lookback = 50) {
    if (!klines || klines.length < lookback) return null;

    const recentKlines = klines.slice(-lookback);
    const prices = recentKlines.map(k => parseFloat(k[4]));
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const range = high - low;

    const currentPrice = parseFloat(klines[klines.length - 1][4]);

    // Determine if uptrend or downtrend
    const isUptrend = prices[prices.length - 1] > prices[0];

    let levels;
    if (isUptrend) {
      // Retracement from high
      levels = {
        '0%': high,
        '23.6%': high - (range * 0.236),
        '38.2%': high - (range * 0.382),
        '50%': high - (range * 0.5),
        '61.8%': high - (range * 0.618),
        '78.6%': high - (range * 0.786),
        '100%': low
      };
    } else {
      // Retracement from low
      levels = {
        '0%': low,
        '23.6%': low + (range * 0.236),
        '38.2%': low + (range * 0.382),
        '50%': low + (range * 0.5),
        '61.8%': low + (range * 0.618),
        '78.6%': low + (range * 0.786),
        '100%': high
      };
    }

    // Find nearest level
    let nearestLevel = null;
    let minDistance = Infinity;

    Object.entries(levels).forEach(([name, price]) => {
      const distance = Math.abs(currentPrice - price);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLevel = { name, price, distance: (distance / currentPrice) * 100 };
      }
    });

    return {
      high,
      low,
      range,
      levels,
      trend: isUptrend ? 'UPTREND' : 'DOWNTREND',
      nearestLevel,
      atKeyLevel: nearestLevel && nearestLevel.distance < 0.5 // Within 0.5%
    };
  }

  // ==================== Market Structure ====================

  detectMarketStructure(klines, swingPeriod = 5) {
    if (!klines || klines.length < swingPeriod * 3) return null;

    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));
    const closes = klines.map(k => parseFloat(k[4]));

    const swingHighs = [];
    const swingLows = [];

    // Detect swing points
    for (let i = swingPeriod; i < klines.length - swingPeriod; i++) {
      // Swing high
      if (highs[i] === Math.max(...highs.slice(i - swingPeriod, i + swingPeriod + 1))) {
        swingHighs.push({ index: i, price: highs[i] });
      }
      // Swing low
      if (lows[i] === Math.min(...lows.slice(i - swingPeriod, i + swingPeriod + 1))) {
        swingLows.push({ index: i, price: lows[i] });
      }
    }

    // Determine trend based on swing points
    let structure = 'RANGING';
    let signal = 'NEUTRAL';

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const recentHighs = swingHighs.slice(-2);
      const recentLows = swingLows.slice(-2);

      // Higher highs and higher lows = uptrend
      if (recentHighs[1].price > recentHighs[0].price &&
          recentLows[1].price > recentLows[0].price) {
        structure = 'UPTREND';
        signal = 'BULLISH';
      }
      // Lower highs and lower lows = downtrend
      else if (recentHighs[1].price < recentHighs[0].price &&
               recentLows[1].price < recentLows[0].price) {
        structure = 'DOWNTREND';
        signal = 'BEARISH';
      }
    }

    const currentPrice = closes[closes.length - 1];
    const lastSwingHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;
    const lastSwingLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : null;

    // Check for breakouts
    let breakout = null;
    if (lastSwingHigh && currentPrice > lastSwingHigh) {
      breakout = 'BULLISH_BREAKOUT';
      signal = 'STRONG_BULLISH';
    }
    if (lastSwingLow && currentPrice < lastSwingLow) {
      breakout = 'BEARISH_BREAKOUT';
      signal = 'STRONG_BEARISH';
    }

    return {
      structure,
      signal,
      swingHighs: swingHighs.slice(-3),
      swingLows: swingLows.slice(-3),
      lastSwingHigh,
      lastSwingLow,
      breakout
    };
  }

  // ==================== Funding Rate Divergence ====================

  detectFundingDivergence(fundingRate, priceChange24h) {
    if (fundingRate === null || fundingRate === undefined) return null;

    const fundingPercent = fundingRate * 100;

    let divergence = 'NONE';
    let signal = 'NEUTRAL';

    // Positive funding (longs paying shorts) + price dropping = potential squeeze
    if (fundingPercent > 0.01 && priceChange24h < -2) {
      divergence = 'BULLISH';
      signal = 'POTENTIAL_LONG_SQUEEZE';
    }
    // Negative funding (shorts paying longs) + price rising = potential squeeze
    else if (fundingPercent < -0.01 && priceChange24h > 2) {
      divergence = 'BEARISH';
      signal = 'POTENTIAL_SHORT_SQUEEZE';
    }

    return {
      fundingRate: fundingPercent,
      priceChange: priceChange24h,
      divergence,
      signal,
      extremeFunding: Math.abs(fundingPercent) > 0.05 // 0.05% is extreme
    };
  }

  // ==================== Delta Divergence (CVD vs Price) ====================

  detectDeltaDivergence(cvdHistory, priceHistory) {
    if (!cvdHistory || !priceHistory || cvdHistory.length < 10 || priceHistory.length < 10) {
      return null;
    }

    const recentCVD = cvdHistory.slice(-10);
    const recentPrices = priceHistory.slice(-10);

    const cvdTrend = recentCVD[recentCVD.length - 1] - recentCVD[0];
    const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[0];

    let divergence = 'NONE';
    let signal = 'NEUTRAL';

    // CVD rising but price falling = bullish divergence (accumulation)
    if (cvdTrend > 0 && priceTrend < 0) {
      divergence = 'BULLISH';
      signal = 'HIDDEN_ACCUMULATION';
    }
    // CVD falling but price rising = bearish divergence (distribution)
    else if (cvdTrend < 0 && priceTrend > 0) {
      divergence = 'BEARISH';
      signal = 'HIDDEN_DISTRIBUTION';
    }

    return {
      cvdTrend: cvdTrend > 0 ? 'RISING' : 'FALLING',
      priceTrend: priceTrend > 0 ? 'RISING' : 'FALLING',
      divergence,
      signal,
      strength: Math.abs(cvdTrend) > 1000000 ? 'STRONG' : 'WEAK'
    };
  }
}

module.exports = new AdvancedIndicators();
