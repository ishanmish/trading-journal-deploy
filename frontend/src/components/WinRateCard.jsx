import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const WinRateCard = ({ daily, weekly, monthly }) => {
    const [period, setPeriod] = useState('DAILY');

    const getStats = () => {
        switch (period) {
            case 'WEEKLY': return { ...weekly, title: 'WEEKLY WIN %', labelWin: 'Win Weeks', labelLoss: 'Loss Weeks' };
            case 'MONTHLY': return { ...monthly, title: 'MONTHLY WIN %', labelWin: 'Win Months', labelLoss: 'Loss Months' };
            default: return { ...daily, title: 'DAILY WIN %', labelWin: 'Win Days', labelLoss: 'Loss Days' };
        }
    };

    const stats = getStats();

    // Data for Chart
    const data = [
        { name: 'Win', value: stats.wins, color: '#4ade80' },
        { name: 'Loss', value: stats.losses, color: '#f87171' },
    ];

    // If no trades, use grey ring
    if (stats.total === 0) {
        data.push({ name: 'Empty', value: 1, color: '#333' });
    }

    return (
        <div className="bg-[#0f0f0f] border border-[#262626] rounded-3xl p-6 flex items-center justify-between min-h-[12rem] relative overflow-hidden group hover:border-[#333] transition-colors">

            {/* Period Toggle (Top Right) */}
            <div className="absolute top-4 right-4 flex bg-black border border-[#262626] rounded-full p-0.5 z-20">
                {['DAILY', 'WEEKLY', 'MONTHLY'].map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${period === p
                                ? 'bg-[#262626] text-white shadow-sm'
                                : 'text-[#52525b] hover:text-[#a1a1aa]'
                            }`}
                    >
                        {p.charAt(0)}
                    </button>
                ))}
            </div>

            {/* Left: Stats */}
            <div className="flex flex-col justify-between h-full z-10 w-1/2">
                <div className="mb-4">
                    <h3 className="text-[#a1a1aa] text-xs font-bold uppercase tracking-wider mb-1">{stats.title}</h3>
                    <div className="text-5xl font-bold text-white">{Math.round(stats.rate)}%</div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center text-xs text-[#a1a1aa] border-b border-[#262626] pb-1">
                        <span>{stats.labelWin}</span>
                        <span className="text-[#4ade80] font-bold text-base">{stats.wins}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-[#a1a1aa] border-b border-[#262626] pb-1">
                        <span>{stats.labelLoss}</span>
                        <span className="text-[#f87171] font-bold text-base">{stats.losses}</span>
                    </div>
                </div>
            </div>

            {/* Right: Chart */}
            <div className="w-1/2 h-32 relative mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats.total > 0 ? data : [{ value: 1 }]}
                            innerRadius={25}
                            outerRadius={40}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            startAngle={90}
                            endAngle={-270}
                        >
                            {(stats.total > 0 ? data : [{ color: '#333' }]).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default WinRateCard;
