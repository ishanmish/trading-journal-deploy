import React, { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';

const CombinedPerformanceChart = ({ entries }) => {
    const data = useMemo(() => {
        const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        let cumulative = 0;
        let peak = 0;

        return sorted.map(e => {
            cumulative += e.pnl;
            if (cumulative > peak) peak = cumulative;
            const ddAbs = cumulative - peak; // Always <= 0

            return {
                date: e.date.split('T')[0],
                equity: cumulative,
                drawdown: ddAbs
            };
        });
    }, [entries]);

    if (data.length === 0) return <div>No Data</div>;

    const formatYAxis = (val) => {
        if (val === 0) return '0';
        const abs = Math.abs(val);
        if (abs >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
        if (abs >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (abs >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
        return `₹${val}`;
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-gray-800 border border-gray-700 p-3 rounded shadow-lg text-xs">
                    <p className="text-gray-400 font-bold mb-1">{format(parseISO(label), 'MMM do, yyyy')}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.stroke }}>
                            {entry.name}: <span className="text-white font-mono">
                                ₹{entry.value.toLocaleString('en-IN')}
                            </span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 w-full h-[600px] flex flex-col">
            <h3 className="text-gray-400 font-semibold mb-2">Performance Curve</h3>

            {/* Top: Equity Chart (70%) */}
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        syncId="perf"
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis
                            orientation="right"
                            stroke="#9CA3AF"
                            tickFormatter={formatYAxis}
                            tick={{ fontSize: 10 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="equity"
                            name="Equity"
                            stroke="#10B981"
                            fill="url(#colorEquity)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom: Drawdown Chart (30%) */}
            <div className="h-[150px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        syncId="perf"
                        margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#6B7280"
                            tickFormatter={(str) => format(parseISO(str), "MMM ''yy")}
                            minTickGap={40}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            orientation="right"
                            stroke="#9CA3AF"
                            tickFormatter={formatYAxis}
                            tick={{ fontSize: 10 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="drawdown"
                            name="Drawdown"
                            stroke="#EF4444"
                            fill="url(#colorDD)"
                            strokeWidth={1}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CombinedPerformanceChart;
