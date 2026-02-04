import React, { useMemo } from 'react';
import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { format } from 'date-fns';

const DrawdownChart = ({ entries }) => {
    const data = useMemo(() => {
        const dailyPnL = {};
        entries.forEach(e => {
            const date = e.date.split('T')[0];
            if (!dailyPnL[date]) dailyPnL[date] = 0;
            dailyPnL[date] += e.pnl;
        });

        const sortedDates = Object.keys(dailyPnL).sort();
        let cumulative = 0;
        let peak = 0;

        return sortedDates.map(date => {
            cumulative += dailyPnL[date];
            if (cumulative > peak) peak = cumulative;
            const drawdown = peak === 0 ? 0 : cumulative - peak;

            return {
                date,
                drawdown: drawdown,
                peak: peak,
                equity: cumulative
            };
        });
    }, [entries]);

    if (data.length === 0) return <div className="text-gray-500 text-center h-full flex items-center justify-center">No Data</div>;

    return (
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 h-[300px]">
            <h3 className="text-gray-400 font-semibold mb-2">Drawdown</h3>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(str) => format(new Date(str), 'MMM d')}
                        stroke="#9CA3AF"
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelFormatter={(label) => format(new Date(label), 'MMM do, yyyy')}
                        formatter={(value, name) => {
                            if (name === "drawdown") return [`₹${value.toLocaleString()}`, 'Drawdown'];
                            return [value, name];
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="drawdown"
                        stroke="#EF4444"
                        fillOpacity={1}
                        fill="url(#colorDD)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DrawdownChart;
