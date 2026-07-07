/**
 * BACKTEST RUNNER
 * Run this to validate your system's real accuracy on historical data
 */

const backtestEngine = require('./backtesting-engine');

async function runBacktest() {
  console.log('\n🔬 BACKTESTING ENGINE - Historical Validation\n');
  console.log('='.repeat(80));

  const symbols = [
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'SOLUSDT',
    'XRPUSDT'
  ];

  console.log(`Testing ${symbols.length} symbols...`);
  console.log('This will take 5-10 minutes depending on API rate limits.\n');

  for (const symbol of symbols) {
    console.log(`\n📊 Backtesting ${symbol}...`);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // 3 months back

    const endDate = new Date();

    const results = await backtestEngine.backtest(
      symbol,
      startDate.toISOString(),
      endDate.toISOString()
    );

    if (results) {
      console.log(`\n✅ ${symbol} Results:`);
      console.log('─'.repeat(80));

      ['scalping', 'intraday', 'swing'].forEach(strategy => {
        const data = results[strategy];
        console.log(`\n${strategy.toUpperCase()}:`);
        console.log(`  Win Rate: ${data.winRate}%`);
        console.log(`  Profit Factor: ${data.profitFactor}`);
        console.log(`  Avg Profit: ${data.avgProfit}%`);
        console.log(`  Total Trades: ${data.totalTrades} (${data.wins}W / ${data.losses}L)`);
      });
    }

    // Wait to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 BACKTEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\n💡 TIP: If win rate is below 60%, try:');
  console.log('   1. Increase signal strength thresholds in config.js');
  console.log('   2. Require higher confluence alignment');
  console.log('   3. Filter out low volatility periods');
  console.log('\n');
}

runBacktest().catch(console.error);
