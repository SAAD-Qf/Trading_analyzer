/**
 * ENHANCED SERVER V5 - FINAL VERSION
 * All 9 Advanced Modules + 3 Critical Filters
 * Target Accuracy: 73-76% (Elite Performance)
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');

const config = require('./config');
const marketData = require('./market-data');
const integratedAnalyzer = require('./integrated-analyzer-v2');
const backtestEngine = require('./backtesting-engine');
const signalPersistence = require('./signal-persistence');
const PaperTrading = require('./paper-trading');

// Initialize systems
const paperTrading = new PaperTrading(config.paperTrading);

// Express and WebSocket setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'enhanced-dashboard-v2.html'));
});

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('📱 Dashboard connected');

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Main enhanced analysis
async function analyzeSymbol(symbol) {
  try {
    const data = await marketData.getCompleteMarketData(symbol);
    if (!data || !data.spotPrice) return null;

    const result = await integratedAnalyzer.analyzeSymbolEnhanced(symbol, data);
    return result;

  } catch (error) {
    console.error(`❌ ${symbol}: ${error.message}`);
    return null;
  }
}

function displayEnhancedSignal(result) {
  const { symbol, price, priceChange24h, signals, entryExit, regime, confluence, smartMoney, filters, realAccuracy } = result;

  console.log(`\n📊 ${symbol} | $${price.toFixed(4)} (${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%)`);

  // Primary signal with real accuracy
  const primary = signals.primary;
  const emoji = primary.action.includes('BUY') ? '🟢' : primary.action.includes('SELL') ? '🔴' : '⚪';
  console.log(`${emoji} ${primary.action} | ${primary.type} | Conf: ${primary.confidence} | Real Accuracy: ${realAccuracy}%`);

  // Filter status
  const filterStatus = [];
  if (filters.persistence && filters.persistence.persistent) {
    filterStatus.push('✓ Persistent');
  } else if (filters.persistence && filters.persistence.flickering) {
    filterStatus.push('✗ Flickering');
  }

  if (filters.btcCorrelation && filters.btcCorrelation.allowed) {
    filterStatus.push('✓ BTC-OK');
  } else if (filters.btcCorrelation && !filters.btcCorrelation.allowed) {
    filterStatus.push('✗ BTC-Block');
  }

  if (filters.volumeConfirmation && filters.volumeConfirmation.valid) {
    filterStatus.push('✓ Vol-OK');
  } else if (filters.volumeConfirmation && !filters.volumeConfirmation.valid) {
    filterStatus.push('✗ Vol-Weak');
  }

  if (filterStatus.length > 0) {
    console.log(`   Filters: ${filterStatus.join(' | ')}`);
  }

  // Entry/Exit for primary signal
  if (entryExit && entryExit[primary.type.toLowerCase()]) {
    const entry = entryExit[primary.type.toLowerCase()];
    console.log(`   Entry: $${entry.entryPrice} | SL: $${entry.stopLoss} (-${entry.stopLossPercent}%) | TP: $${entry.takeProfit} (+${entry.takeProfitPercent}%)`);
    console.log(`   R:R ${entry.riskReward}:1 | Size: ${(entry.positionSize * 100).toFixed(2)}% | ${entry.timing.recommendation}`);
  }

  // Regime and confluence
  if (regime) {
    console.log(`   📈 ${regime.regime} (ADX: ${regime.adx}, Chop: ${regime.choppiness})`);
  }

  if (confluence && confluence.aligned) {
    console.log(`   ⏱️ Multi-TF: ✓ ${confluence.direction} (${confluence.strength.toFixed(0)}%)`);
  } else if (confluence) {
    console.log(`   ⏱️ Multi-TF: ✗ Not aligned`);
  }

  if (smartMoney && smartMoney.signal !== 'NEUTRAL') {
    console.log(`   💰 Smart Money: ${smartMoney.signal} | Whale: ${smartMoney.whale.dominance} | Retail: ${smartMoney.retail.dominance}`);
  }

  // Filter reasons
  if (primary.filterReasons && primary.filterReasons.length > 0) {
    console.log(`   ${primary.filterReasons.join(' | ')}`);
  }
}

async function runEnhancedAnalysis() {
  console.log(`\n${'='.repeat(120)}`);
  console.log(`🚀 ENHANCED SYSTEM V5 - FINAL - ${new Date().toLocaleString()}`);
  console.log('='.repeat(120));

  const results = [];
  let signalsGenerated = 0;
  let signalsFiltered = 0;

  for (const symbol of config.symbols) {
    const result = await analyzeSymbol(symbol);
    if (result) {
      results.push(result);

      // Count signals
      if (result.signals.primary.action !== 'HOLD') {
        signalsGenerated++;

        // Check if any filter blocked it
        if (result.filters.persistence && !result.filters.persistence.persistent) {
          signalsFiltered++;
        }
        if (result.filters.btcCorrelation && !result.filters.btcCorrelation.allowed) {
          signalsFiltered++;
        }
        if (result.filters.volumeConfirmation && !result.filters.volumeConfirmation.valid) {
          signalsFiltered++;
        }
      }

      displayEnhancedSignal(result);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Clean old signal history
  signalPersistence.clearOldSignals();

  // Validate previous signals
  const validation = await backtestEngine.validateSignals();
  if (validation) {
    console.log(`\n📊 REAL-TIME VALIDATION:`);
    console.log(`   Total validated: ${validation.totalValidated} signals`);
    console.log(`   Correct: ${validation.correct} | Incorrect: ${validation.incorrect}`);
    console.log(`   🎯 REAL ACCURACY: ${validation.realAccuracy}`);
  }

  // Paper trading
  if (config.paperTrading.enabled) {
    const currentPrices = {};
    results.forEach(r => currentPrices[r.symbol] = r.price);

    const closedTrades = paperTrading.checkOpenPositions(currentPrices);
    closedTrades.forEach(trade => {
      console.log(`\n💰 Closed: ${trade.symbol} ${trade.type} | P&L: ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
    });

    // Open new trades only on high-quality signals
    results.forEach(result => {
      const signal = result.signals.primary;
      const shouldTrade = signalPersistence.shouldTrade(result.symbol, signal);

      if (shouldTrade &&
          signal.confidence === 'HIGH' &&
          result.realAccuracy >= 65 &&
          result.filters.btcCorrelation.allowed &&
          result.filters.volumeConfirmation.valid) {

        const entry = result.entryExit[signal.type.toLowerCase()];
        if (entry) {
          const tradeSignal = {
            action: signal.action,
            confidence: signal.confidence,
            accuracy: result.realAccuracy
          };

          const analysis = {
            symbol: result.symbol,
            price: result.price,
            stopLoss: parseFloat(entry.stopLoss),
            takeProfit: parseFloat(entry.takeProfit)
          };

          const openResult = paperTrading.openTrade(tradeSignal, analysis);
          if (openResult.success) {
            console.log(`\n✅ Opened: ${result.symbol} ${openResult.trade.type} @ $${openResult.trade.entryPrice.toFixed(4)}`);
          }
        }
      }
    });
  }

  // Summary
  console.log(`\n${'='.repeat(120)}`);
  console.log('📈 SUMMARY:');

  const highConfidence = results.filter(r => r.signals.primary.confidence === 'HIGH' && r.signals.primary.action !== 'HOLD').length;
  const aligned = results.filter(r => r.confluence && r.confluence.aligned).length;
  const persistent = results.filter(r => r.filters.persistence && r.filters.persistence.persistent).length;
  const avgAccuracy = results.reduce((sum, r) => sum + r.realAccuracy, 0) / results.length;

  console.log(`   Signals Generated: ${signalsGenerated} | Filtered Out: ${signalsFiltered}`);
  console.log(`   High Confidence: ${highConfidence} | Multi-TF Aligned: ${aligned} | Persistent: ${persistent}`);
  console.log(`   Average Real Accuracy: ${avgAccuracy.toFixed(1)}%`);

  if (validation) {
    console.log(`   Validated Win Rate: ${validation.realAccuracy}`);
  }

  console.log(`   💰 Paper Balance: $${paperTrading.balance.toFixed(2)} | Win Rate: ${paperTrading.stats.winRate.toFixed(1)}%`);
  console.log('='.repeat(120));

  broadcast({ type: 'analysis', data: results });
}

function startServer() {
  const port = config.dashboard.port;

  server.listen(port, () => {
    console.log('\n🚀 ENHANCED CRYPTO TRADING SYSTEM V5 - FINAL\n');
    console.log(`┌${'─'.repeat(118)}┐`);
    console.log(`│ 📊 Dashboard: http://localhost:${port}${' '.repeat(89)}│`);
    console.log(`│ ✨ ALL 9 MODULES + 3 CRITICAL FILTERS ACTIVE:${' '.repeat(68)}│`);
    console.log(`│                                                                                                         │`);
    console.log(`│ CORE MODULES:${' '.repeat(102)}│`);
    console.log(`│    ✓ Multi-Timeframe Confluence${' '.repeat(84)}│`);
    console.log(`│    ✓ Market Regime Detection${' '.repeat(87)}│`);
    console.log(`│    ✓ Smart Money vs Retail Flow${' '.repeat(83)}│`);
    console.log(`│    ✓ Adaptive Dynamic Thresholds${' '.repeat(82)}│`);
    console.log(`│    ✓ Perfect Entry/SL/TP Calculator${' '.repeat(79)}│`);
    console.log(`│    ✓ Real-Time Signal Validation${' '.repeat(83)}│`);
    console.log(`│                                                                                                         │`);
    console.log(`│ CRITICAL FILTERS (NEW):${' '.repeat(92)}│`);
    console.log(`│    ✓ Signal Persistence (Anti-Flicker)${' '.repeat(77)}│`);
    console.log(`│    ✓ BTC Correlation Filter${' '.repeat(88)}│`);
    console.log(`│    ✓ Volume Confirmation${' '.repeat(91)}│`);
    console.log(`│                                                                                                         │`);
    console.log(`│ 🎯 Target Accuracy: 73-76% (Elite Performance)${' '.repeat(68)}│`);
    console.log(`└${'─'.repeat(118)}┘\n`);

    if (config.dashboard.autoOpenBrowser) {
      const url = `http://localhost:${port}`;
      const start = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${start} ${url}`);
    }

    console.log('⏳ Starting enhanced analysis...\n');
    runEnhancedAnalysis();
    setInterval(runEnhancedAnalysis, config.analysisInterval);
  });
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();
