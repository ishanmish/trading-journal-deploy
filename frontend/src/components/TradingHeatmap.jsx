import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    getDay,
    subMonths,
    subWeeks,
    isSameMonth,
    isSameWeek
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const formatCurrency = (val) => {
    return '₹' + val.toLocaleString('en-IN', {
        maximumFractionDigits: 0
    });
};

const formatCompact = (val) => {
    if (Math.abs(val) >= 10000000) return (val / 10000000).toFixed(2) + 'Cr';
    if (Math.abs(val) >= 100000) return (val / 100000).toFixed(2) + 'L';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val.toString();
};

const TradingHeatmap = ({ entries }) => {
    const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' or 'bar'
    const [period, setPeriod] = useState('monthly');   // 'monthly' or 'weekly'

    const pnlMap = useMemo(() => {
        const map = {};
        entries.forEach(e => {
            const dateStr = e.date.split('T')[0];
            if (!map[dateStr]) map[dateStr] = 0;
            map[dateStr] += e.pnl;
        });
        return map;
    }, [entries]);

    const [isExpanded, setIsExpanded] = useState(false);

    const items = useMemo(() => {
        if (!entries || entries.length === 0) return [];

        const dates = entries.map(e => new Date(e.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates, new Date()));

        const list = [];
        if (period === 'monthly') {
            let current = startOfMonth(minDate);
            const end = endOfMonth(maxDate);
            while (current <= end) {
                list.push(current);
                current = subMonths(current, -1);
            }
        } else {
            // Weekly
            let current = startOfWeek(minDate, { weekStartsOn: 1 });
            const end = endOfWeek(maxDate, { weekStartsOn: 1 });
            while (current <= end) {
                list.push(current);
                current = subWeeks(current, -1);
            }
        }
        return list.reverse(); // Latest first
    }, [entries, period]);

    const displayedItems = isExpanded ? items : items.slice(0, 7);

    const [tooltip, setTooltip] = useState(null);

    const handleMouseEnter = (e, date, pnl) => {
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            x: rect.left + rect.width / 2, // Center horizontally
            y: rect.top - 10,             // Position above
            date,
            pnl
        });
    };

    return (
        <div className="bg-[#0f0f0f] p-6 rounded-3xl border border-[#262626] w-full mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-[#a1a1aa] font-bold uppercase tracking-wider text-xs">Performance View</h3>

                <div className="flex items-center gap-4">
                    {/* Period Toggle (Pill Style) */}
                    <div className="bg-black border border-[#262626] rounded-full p-1 flex h-[36px] items-center">
                        <button
                            onClick={() => setPeriod('weekly')}
                            className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all h-full flex items-center ${period === 'weekly' ? 'bg-[#262626] text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setPeriod('monthly')}
                            className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all h-full flex items-center ${period === 'monthly' ? 'bg-[#262626] text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
                        >
                            Monthly
                        </button>
                    </div>

                    {/* View Toggle (Pill Style) */}
                    <div className="bg-black border border-[#262626] rounded-full p-1 flex h-[36px] items-center">
                        <button
                            onClick={() => setViewMode('heatmap')}
                            className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all h-full flex items-center ${viewMode === 'heatmap' ? 'bg-[#262626] text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
                        >
                            Heatmap
                        </button>
                        <button
                            onClick={() => setViewMode('bar')}
                            className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all h-full flex items-center ${viewMode === 'bar' ? 'bg-[#262626] text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
                        >
                            Bar Chart
                        </button>
                    </div>
                </div>
            </div>

            <div className={`grid gap-4 pb-4 ${viewMode === 'heatmap' ? 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]' : 'grid-cols-1 overflow-x-auto min-w-full'}`}>
                {viewMode === 'heatmap' ? (
                    displayedItems.map((itemDate, index) => {
                        const start = period === 'monthly' ? startOfMonth(itemDate) : startOfWeek(itemDate, { weekStartsOn: 1 });
                        const end = period === 'monthly' ? endOfMonth(itemDate) : endOfWeek(itemDate, { weekStartsOn: 1 });
                        const days = eachDayOfInterval({ start, end });

                        let periodPnL = 0;
                        days.forEach(d => {
                            const val = pnlMap[format(d, 'yyyy-MM-dd')];
                            if (val) periodPnL += val;
                        });

                        // Grid Logic for months or weeks
                        const gridWeeks = [];
                        let currentWeek = new Array(7).fill(null);
                        const startOffset = period === 'monthly' ? (getDay(start) + 6) % 7 : 0;

                        for (let i = 0; i < startOffset; i++) currentWeek[i] = null;

                        days.forEach(day => {
                            const weekDayIndex = (getDay(day) + 6) % 7;
                            currentWeek[weekDayIndex] = day;
                            if (weekDayIndex === 6) {
                                gridWeeks.push(currentWeek);
                                currentWeek = new Array(7).fill(null);
                            }
                        });
                        if (currentWeek.some(d => d !== null)) gridWeeks.push(currentWeek);

                        return (
                            <div key={index} className="flex flex-col w-full min-h-[160px] bg-gradient-to-b from-[#1e1e1e] to-[#0a0a0a] p-4 rounded-xl border border-[#262626] hover:border-[#404040] transition-colors justify-between">
                                <div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider flex justify-between">
                                        <span>{period === 'monthly' ? format(itemDate, "MMM ''yy") : `Week ${format(itemDate, 'w')}`}</span>
                                        {period === 'weekly' && <span className="text-[8px] opacity-50">{format(itemDate, 'MMM d')}</span>}
                                    </div>

                                    <div className="flex gap-1">
                                        {gridWeeks.map((week, wIndex) => (
                                            <div key={wIndex} className="flex flex-col gap-1">
                                                {week.map((day, dIndex) => {
                                                    if (!day) return <div key={dIndex} className="w-3.5 h-3.5" />;
                                                    const pnl = pnlMap[format(day, 'yyyy-MM-dd')];
                                                    let bgClass = 'bg-gray-800/20 border border-gray-700/30';
                                                    if (pnl > 0) {
                                                        if (pnl > 50000) bgClass = 'bg-green-600/60 border-transparent';
                                                        else if (pnl > 10000) bgClass = 'bg-green-600/40 border-transparent';
                                                        else bgClass = 'bg-green-600/20 border-transparent';
                                                    } else if (pnl < 0) {
                                                        if (pnl < -50000) bgClass = 'bg-red-600/60 border-transparent';
                                                        else if (pnl < -10000) bgClass = 'bg-red-600/40 border-transparent';
                                                        else bgClass = 'bg-red-600/20 border-transparent';
                                                    }

                                                    return (
                                                        <div
                                                            key={dIndex}
                                                            className={`w-3.5 h-3.5 rounded-[1px] ${bgClass} cursor-pointer transition-all duration-200 hover:scale-125 hover:z-10 hover:border-white border border-transparent`}
                                                            onMouseEnter={(e) => handleMouseEnter(e, day, pnl)}
                                                            onMouseLeave={() => setTooltip(null)}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className={`mt-2 text-[10px] font-medium ${periodPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                                    {periodPnL >= 0 ? "+" : "-"}₹{formatCompact(Math.abs(periodPnL))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    /* Bar Chart View */
                    <div className="flex items-end h-64 gap-2 pt-12">
                        {items.map((itemDate, index) => {
                            const start = period === 'monthly' ? startOfMonth(itemDate) : startOfWeek(itemDate, { weekStartsOn: 1 });
                            const end = period === 'monthly' ? endOfMonth(itemDate) : endOfWeek(itemDate, { weekStartsOn: 1 });
                            const days = eachDayOfInterval({ start, end });

                            let periodPnL = 0;
                            days.forEach(d => {
                                const val = pnlMap[format(d, 'yyyy-MM-dd')];
                                if (val) periodPnL += val;
                            });

                            const maxPnL = Math.max(...items.map(i => {
                                const s = period === 'monthly' ? startOfMonth(i) : startOfWeek(i, { weekStartsOn: 1 });
                                const e = period === 'monthly' ? endOfMonth(i) : endOfWeek(i, { weekStartsOn: 1 });
                                let p = 0;
                                eachDayOfInterval({ start: s, end: e }).forEach(d => {
                                    const v = pnlMap[format(d, 'yyyy-MM-dd')];
                                    if (v) p += v;
                                });
                                return Math.abs(p);
                            }), 1);

                            const barHeight = (Math.abs(periodPnL) / maxPnL) * 100;

                            return (
                                <motion.div
                                    key={index}
                                    className="flex-1 flex flex-col items-center group relative h-full justify-end"
                                    onMouseEnter={(e) => handleMouseEnter(e, itemDate, periodPnL)}
                                    onMouseLeave={() => setTooltip(null)}
                                >
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${barHeight}%` }}
                                        className={`w-full rounded-t ${periodPnL >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'} group-hover:opacity-100 opacity-80 transition-opacity`}
                                    />
                                    <div className="text-[8px] text-gray-500 mt-2 truncate w-full text-center group-hover:text-white transition-colors">
                                        {period === 'monthly' ? format(itemDate, 'MMM yy') : format(itemDate, 'd/M')}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {items.length > 7 && (
                <div className="flex justify-center mt-2 border-t border-[#262626] pt-4">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs font-bold text-[#52525b] hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1"
                    >
                        {isExpanded ? 'Show Less' : `Show all ${items.length} periods`}
                        <span>{isExpanded ? '↑' : '↓'}</span>
                    </button>
                </div>
            )}

            {/* Tooltip Portal */}
            {createPortal(
                tooltip && (
                    <div
                        style={{
                            top: tooltip.y,
                            left: tooltip.x,
                            transform: 'translate(-50%, -120%)',
                            position: 'fixed',
                            zIndex: 99999
                        }}
                        className="pointer-events-none bg-black text-white text-[11px] px-3 py-1.5 rounded border border-gray-600 shadow-2xl whitespace-nowrap"
                    >
                        <div className="font-bold text-gray-300 mb-0.5 uppercase tracking-wide text-[10px]">{format(tooltip.date, 'MMM do')}</div>
                        <div className={!tooltip.pnl ? "text-gray-500" : tooltip.pnl > 0 ? "text-green-400 font-mono text-xs" : "text-red-400 font-mono text-xs"}>
                            {tooltip.pnl ? formatCurrency(tooltip.pnl) : "No Trade"}
                        </div>
                    </div>
                ),
                document.body
            )}
        </div>
    );
};

export default TradingHeatmap;
