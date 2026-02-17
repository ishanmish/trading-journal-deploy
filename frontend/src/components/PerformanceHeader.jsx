import React from 'react';
import { motion } from 'framer-motion';
import CombinedPerformanceChart from './CombinedPerformanceChart';
import TradingHeatmap from './TradingHeatmap';

const PerformanceHeader = ({ stats, entries }) => {
    // Calculate Drawdown
    const { currentDrawdown, isAllTimeHigh } = React.useMemo(() => {
        if (!entries || entries.length === 0) return { currentDrawdown: 0, isAllTimeHigh: true };

        const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        let cumulative = 0;
        let maxEquity = -Infinity;

        sorted.forEach(e => {
            cumulative += e.pnl;
            if (cumulative > maxEquity) maxEquity = cumulative;
        });

        // Initialize maxEquity to 0 if starting negative or 0 based
        if (maxEquity < 0 && cumulative < 0) maxEquity = 0;

        // Actually, logic usually is Peak so far. If we start at 0.
        // Let's assume starting capital is 0 for PnL tracking purposes, 
        // so Peak is Max(0, MaxCumPnL).
        maxEquity = Math.max(0, maxEquity);

        const drawdown = cumulative - maxEquity; // Should be <= 0
        return { currentDrawdown: drawdown, isAllTimeHigh: drawdown >= -100 }; // Tolerance
    }, [entries]);

    const cardHover = { scale: 1.05, borderColor: '#60A5FA', boxShadow: '0 0 20px rgba(96, 165, 250, 0.2)' };

    return (
        <div className="space-y-6 mb-8">
            {/* Top Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={cardHover}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer transition-colors"
                >
                    <h3 className="text-gray-400 text-sm">Total PnL</h3>
                    <p className={`text-2xl font-bold ${stats?.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ₹{stats?.total_pnl?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={cardHover}
                    transition={{ delay: 0.05 }}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer"
                >
                    <h3 className="text-gray-400 text-sm">Win Rate</h3>
                    <p className="text-2xl font-bold text-blue-400">{stats?.win_rate?.toFixed(1)}%</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={cardHover}
                    transition={{ delay: 0.1 }}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer"
                >
                    <h3 className="text-gray-400 text-sm">Days Logged</h3>
                    <p className="text-2xl font-bold text-yellow-400">{stats?.total_days_logged}</p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={cardHover}
                    transition={{ delay: 0.15 }}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer"
                >
                    <h3 className="text-gray-400 text-sm">Brokerage Paid</h3>
                    <p className="text-2xl font-bold text-orange-400">
                        ₹{(stats?.total_brokerage || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={cardHover}
                    transition={{ delay: 0.2 }}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer"
                >
                    <h3 className="text-gray-400 text-sm">Taxes Paid</h3>
                    <p className="text-2xl font-bold text-pink-400">
                        ₹{(stats?.total_taxes || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={cardHover}
                    transition={{ delay: 0.25 }}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 cursor-pointer"
                >
                    <h3 className="text-gray-400 text-sm">Current Drawdown</h3>
                    {isAllTimeHigh ? (
                        <p className="text-xl font-bold text-green-400">All Time High! 🙂</p>
                    ) : (
                        <p className="text-2xl font-bold text-red-300">
                            -₹{Math.abs(currentDrawdown).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                    )}
                </motion.div>
            </div>

            {/* Combined Chart (Full Width) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="w-full"
            >
                <CombinedPerformanceChart entries={entries} />
            </motion.div>

            {/* Heatmap */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                <TradingHeatmap entries={entries} />
            </motion.div>
        </div>
    );
};

export default PerformanceHeader;
