/**
 * Smart Money vs Retail Trade Classification
 */

class SmartMoneyFlow {
  analyzeTradeFlow(trades) {
    if (!trades || trades.length === 0) return null;

    // Classify trades by size
    const volumes = trades.map(t => parseFloat(t.qty || t.quoteQty || 0));
    const sorted = [...volumes].sort((a, b) => a - b);

    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const median = sorted[Math.floor(sorted.length * 0.5)];

    let whaleBuyVolume = 0, whaleSellVolume = 0;
    let smartBuyVolume = 0, smartSellVolume = 0;
    let retailBuyVolume = 0, retailSellVolume = 0;

    let whaleTrades = 0, smartTrades = 0, retailTrades = 0;

    trades.forEach(trade => {
      const volume = parseFloat(trade.qty || trade.quoteQty || 0);
      const isBuy = trade.isBuyerMaker === false;

      if (volume >= p95) {
        // Whale trade (top 5%)
        whaleTrades++;
        if (isBuy) whaleBuyVolume += volume;
        else whaleSellVolume += volume;
      } else if (volume >= p75) {
        // Smart money (75-95 percentile)
        smartTrades++;
        if (isBuy) smartBuyVolume += volume;
        else smartSellVolume += volume;
      } else {
        // Retail (below 75 percentile)
        retailTrades++;
        if (isBuy) retailBuyVolume += volume;
        else retailSellVolume += volume;
      }
    });

    // Calculate deltas
    const whaleDelta = whaleBuyVolume - whaleSellVolume;
    const smartDelta = smartBuyVolume - smartSellVolume;
    const retailDelta = retailBuyVolume - retailSellVolume;

    // Determine signals
    const signals = [];
    let overallSignal = 'NEUTRAL';
    let confidence = 0;

    // Whale accumulation while retail sells = bullish
    if (whaleDelta > 0 && smartDelta > 0 && retailDelta < 0) {
      signals.push('Institutions accumulating, retail selling');
      overallSignal = 'STRONG_BUY';
      confidence = 85;
    }
    // Whale distribution while retail buys = bearish
    else if (whaleDelta < 0 && smartDelta < 0 && retailDelta > 0) {
      signals.push('Institutions distributing, retail buying');
      overallSignal = 'STRONG_SELL';
      confidence = 85;
    }
    // All buying
    else if (whaleDelta > 0 && smartDelta > 0 && retailDelta > 0) {
      signals.push('Broad buying pressure');
      overallSignal = 'BUY';
      confidence = 70;
    }
    // All selling
    else if (whaleDelta < 0 && smartDelta < 0 && retailDelta < 0) {
      signals.push('Broad selling pressure');
      overallSignal = 'SELL';
      confidence = 70;
    }
    // Whales leading
    else if (Math.abs(whaleDelta) > Math.abs(retailDelta) * 2) {
      if (whaleDelta > 0) {
        signals.push('Smart money accumulation');
        overallSignal = 'BUY';
        confidence = 75;
      } else {
        signals.push('Smart money distribution');
        overallSignal = 'SELL';
        confidence = 75;
      }
    }

    // Check for divergence
    const divergence = this.detectDivergence(whaleDelta, retailDelta);
    if (divergence) {
      signals.push(divergence.signal);
    }

    return {
      whale: {
        trades: whaleTrades,
        buyVolume: whaleBuyVolume,
        sellVolume: whaleSellVolume,
        delta: whaleDelta,
        dominance: whaleDelta > 0 ? 'BUYING' : 'SELLING'
      },
      smartMoney: {
        trades: smartTrades,
        buyVolume: smartBuyVolume,
        sellVolume: smartSellVolume,
        delta: smartDelta,
        dominance: smartDelta > 0 ? 'BUYING' : 'SELLING'
      },
      retail: {
        trades: retailTrades,
        buyVolume: retailBuyVolume,
        sellVolume: retailSellVolume,
        delta: retailDelta,
        dominance: retailDelta > 0 ? 'BUYING' : 'SELLING'
      },
      signal: overallSignal,
      confidence,
      signals,
      thresholds: { p75, p95, median }
    };
  }

  detectDivergence(whaleDelta, retailDelta) {
    const whaleDirection = whaleDelta > 0 ? 1 : -1;
    const retailDirection = retailDelta > 0 ? 1 : -1;

    if (whaleDirection !== retailDirection) {
      if (whaleDirection > 0) {
        return {
          type: 'BULLISH_DIVERGENCE',
          signal: 'Whales buying, retail selling (bullish)',
          strength: Math.abs(whaleDelta / Math.max(Math.abs(retailDelta), 1))
        };
      } else {
        return {
          type: 'BEARISH_DIVERGENCE',
          signal: 'Whales selling, retail buying (bearish)',
          strength: Math.abs(whaleDelta / Math.max(Math.abs(retailDelta), 1))
        };
      }
    }

    return null;
  }

  // Weighted CVD based on trade size
  calculateWeightedCVD(trades) {
    if (!trades || trades.length === 0) return 0;

    const volumes = trades.map(t => parseFloat(t.qty || t.quoteQty || 0));
    const p95 = [...volumes].sort((a, b) => a - b)[Math.floor(volumes.length * 0.95)];

    let weightedCVD = 0;

    trades.forEach(trade => {
      const volume = parseFloat(trade.qty || trade.quoteQty || 0);
      const isBuy = trade.isBuyerMaker === false;

      // Weight increases with trade size
      const weight = volume >= p95 ? 3 : volume >= p95 * 0.5 ? 2 : 1;

      if (isBuy) {
        weightedCVD += volume * weight;
      } else {
        weightedCVD -= volume * weight;
      }
    });

    return weightedCVD;
  }
}

module.exports = new SmartMoneyFlow();
