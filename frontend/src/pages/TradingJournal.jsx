import React, { useState, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import client from '../api/client';
import TopBar from '../components/TopBar';
import WinRateCard from '../components/WinRateCard';
import StatCard from '../components/StatCard';
import CustomDatePicker from '../components/CustomDatePicker';
import TradingHeatmap from '../components/TradingHeatmap';
import CombinedPerformanceChart from '../components/CombinedPerformanceChart';
import JournalFeed from '../components/JournalFeed';
import JournalEntryForm from '../components/JournalEntryForm';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

import TimelineScrollbar from '../components/TimelineScrollbar';

const TradingJournal = () => {
    // Data States
    const [stats, setStats] = useState(null);
    const [rawEntries, setRawEntries] = useState([]);
    const [entries, setEntries] = useState([]);
    const [chartData, setChartData] = useState([]); // New state for aggregated chart
    const [loading, setLoading] = useState(true);

    // Timeline Filter State
    const [timelineRange, setTimelineRange] = useState(null);

    // UI States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDate, setEditingDate] = useState(null);
    const [fetchedPnlData, setFetchedPnlData] = useState(null);
    const [fetchingPnl, setFetchingPnl] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        account: 'ALL',
        pnlType: 'NET'
    });

    const accountOptions = ["ALL", "KITE", "GROWW-ME", "GROWW-DAD", "GROWW-MOM"];

    // Fetch Data
    const fetchRawData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.account && filters.account !== 'ALL') params.account = filters.account;

            const entriesRes = await client.get('/journal/entries', { params });
            setRawEntries(entriesRes.data);

        } catch (error) {
            console.error("Error fetching journal data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRawData();
    }, [filters.startDate, filters.endDate, filters.account]);

    // Recalculate Logic with Timeline Filtering
    useEffect(() => {
        if (!rawEntries) return;

        // 1. Process Raw Entries (Number parsing + Net Logic)
        let processed = rawEntries.map(e => {
            let effectivePnL = Number(e.pnl);
            const brokerage = Number(e.brokerage || 0);
            const taxes = Number(e.taxes || 0);

            if (filters.pnlType === 'NET') {
                effectivePnL = effectivePnL - brokerage - taxes;
            }
            return { ...e, pnl: effectivePnL };
        });

        // 2. Filter by Timeline Range (if active)
        if (timelineRange) {
            processed = processed.filter(e => {
                const d = new Date(e.date);
                return d >= timelineRange.start && d <= timelineRange.end;
            });
        }

        setEntries(processed);

        // 3. Aggregate by Date for Stats & Chart
        const dailyMap = {};
        processed.forEach(e => {
            const dateStr = e.date.split('T')[0];
            if (!dailyMap[dateStr]) {
                dailyMap[dateStr] = {
                    date: dateStr,
                    pnl: 0,
                    brokerage: 0,
                    taxes: 0,
                    count: 0
                };
            }
            dailyMap[dateStr].pnl += e.pnl;
        });

        // Convert Map to Array & Sort by Date
        const dailyAggregated = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Update Chart Data State
        setChartData(dailyAggregated);

        // 4. Calculate Stats
        const totalPnL = processed.reduce((sum, e) => sum + e.pnl, 0);
        const winCount = processed.filter(e => e.pnl > 0).length;
        const lossCount = processed.filter(e => e.pnl <= 0).length;
        const totalTrades = processed.length;
        const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

        // Max Drawdown Calculation for selected range
        let peak = -Infinity;
        let maxDD = 0;
        let runningPnL = 0;

        dailyAggregated.forEach(day => {
            runningPnL += day.pnl;
            if (runningPnL > peak) peak = runningPnL;
            const dd = peak - runningPnL;
            if (dd > maxDD) maxDD = dd;
        });

        // Avg Win / Loss
        const wins = processed.filter(e => e.pnl > 0).map(e => e.pnl);
        const losses = processed.filter(e => e.pnl <= 0).map(e => e.pnl);
        const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
        const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

        // Original stats that are still relevant and not replaced by the new snippet
        const totalBrokerage = rawEntries.reduce((sum, e) => sum + Number(e.brokerage || 0), 0);
        const totalTaxes = rawEntries.reduce((sum, e) => sum + Number(e.taxes || 0), 0);
        const displayGross = rawEntries.reduce((sum, e) => sum + Number(e.pnl), 0);

        // Days Stats (from dailyAggregated, which is now timeline-filtered)
        const profitDays = dailyAggregated.filter(e => e.pnl > 0).length;
        const lossDays = dailyAggregated.filter(e => e.pnl < 0).length;
        const totalDays = dailyAggregated.length;
        const dailyWinRate = totalDays > 0 ? (profitDays / totalDays) * 100 : 0;

        // --- Weekly Stats Logic ---
        const weeklyMap = {};
        dailyAggregated.forEach(e => {
            // Use Monday as start of week
            const date = new Date(e.date);
            const weekStart = startOfWeek(date, { weekStartsOn: 1 }).toISOString().split('T')[0];
            if (!weeklyMap[weekStart]) weeklyMap[weekStart] = 0;
            weeklyMap[weekStart] += e.pnl;
        });
        const weeklyValues = Object.values(weeklyMap);
        const weeklyProfitCount = weeklyValues.filter(pnl => pnl > 0).length;
        const weeklyLossCount = weeklyValues.filter(pnl => pnl < 0).length;
        const totalWeeks = weeklyValues.length;
        const weeklyWinRate = totalWeeks > 0 ? (weeklyProfitCount / totalWeeks) * 100 : 0;

        // --- Monthly Stats Logic ---
        const monthlyMap = {};
        dailyAggregated.forEach(e => {
            const monthStart = e.date.substring(0, 7); // YYYY-MM
            if (!monthlyMap[monthStart]) monthlyMap[monthStart] = 0;
            monthlyMap[monthStart] += e.pnl;
        });
        const monthlyValues = Object.values(monthlyMap);
        const monthlyProfitCount = monthlyValues.filter(pnl => pnl > 0).length;
        const monthlyLossCount = monthlyValues.filter(pnl => pnl < 0).length;
        const totalMonths = monthlyValues.length;
        const monthlyWinRate = totalMonths > 0 ? (monthlyProfitCount / totalMonths) * 100 : 0;

        // Best & Worst Day Logic (Using Aggregated Daily Data)
        let bestDay = null;
        let worstDay = null;

        if (dailyAggregated.length > 0) {
            bestDay = dailyAggregated[0];
            worstDay = dailyAggregated[0];

            dailyAggregated.forEach(e => {
                if (e.pnl > bestDay.pnl) bestDay = e;
                if (e.pnl < worstDay.pnl) worstDay = e;
            });
        }

        // Drawdown Logic (Peak - Current) on Daily Aggregated Curve
        let maxEquity = -Infinity;
        let currentEquity = 0;
        let currentDrawdown = 0;
        let lastATHDate = dailyAggregated.length > 0 ? dailyAggregated[0].date : null;

        if (dailyAggregated.length === 0) {
            maxEquity = 0;
        }

        dailyAggregated.forEach(e => {
            currentEquity += e.pnl;

            if (currentEquity >= maxEquity) {
                maxEquity = currentEquity;
                lastATHDate = e.date;
                currentDrawdown = 0;
            } else {
                currentDrawdown = currentEquity - maxEquity;
            }

            if (currentDrawdown < maxDD) maxDD = currentDrawdown; // Update maxDD if this currentDrawdown is worse
        });

        if (maxEquity === -Infinity) maxEquity = 0;

        // Days in DD
        let daysInDD = 0;
        if (currentDrawdown < 0 && lastATHDate) {
            const lastATH = new Date(lastATHDate);
            const lastEntryDate = new Date(dailyAggregated[dailyAggregated.length - 1].date);
            const diffTime = Math.abs(lastEntryDate - lastATH);
            daysInDD = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        setStats({
            total_pnl: totalPnL, // This is netPnL from the instruction
            display_gross: displayGross,
            total_brokerage: totalBrokerage,
            total_taxes: totalTaxes,
            total_charges: totalBrokerage + totalTaxes,

            // Daily Stats
            win_rate: dailyWinRate, // Renamed to avoid conflict with overall winRate
            profit_days: profitDays,
            loss_days: lossDays,
            total_days_logged: totalDays,

            // Weekly Stats
            weekly_win_rate: weeklyWinRate,
            weekly_profit_count: weeklyProfitCount,
            weekly_loss_count: weeklyLossCount,
            total_weeks: totalWeeks,

            // Monthly Stats
            monthly_win_rate: monthlyWinRate,
            monthly_profit_count: monthlyProfitCount,
            monthly_loss_count: monthlyLossCount,
            total_months: totalMonths,

            best_day: bestDay,
            worst_day: worstDay,
            drawdown: currentDrawdown, // This is current drawdown, not maxDD
            last_ath_date: lastATHDate,
            days_in_dd: daysInDD,

            // New stats from instruction
            netPnL: totalPnL,
            winRate: winRate, // Overall win rate based on processed entries
            maxDrawdown: maxDD, // Max drawdown over the selected timeline
            avgWin: avgWin,
            avgLoss: avgLoss,
            totalTrades: totalTrades,
            profitFactor: Math.abs(avgLoss) > 0 ? (avgWin * winCount) / Math.abs(avgLoss * lossCount) : 0
        });
    }, [rawEntries, filters.pnlType, timelineRange]);

    // Handlers
    const handleEdit = (date) => {
        setEditingDate(date);
        setIsModalOpen(true);
    };

    const handleDelete = async (date) => {
        if (window.confirm("Delete log?")) {
            try {
                await client.delete(`/journal/daily_log/${date}`);
                fetchRawData();
            } catch (error) {
                console.error("Error deleting:", error);
            }
        }
    };

    const handleDateRangeChange = ({ startDate, endDate }) => {
        setFilters(prev => ({ ...prev, startDate, endDate }));
    };


    const formatINR = (val) => val ? val.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0';

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] font-sans text-[#ededed] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-[#262626] border-t-[#eab308] rounded-full animate-spin"></div>
                    <p className="text-[#a1a1aa] text-sm">Loading your trading journal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] font-sans text-[#ededed] p-8 max-w-[1600px] mx-auto">
            <TopBar />

            {/* Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">P&L Dashboard</h1>
                    <p className="text-[#a1a1aa] text-sm">All-time data based on your {filters.pnlType.toLowerCase()} P&L.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Date Picker */}
                    <div className="mt-0">
                        <CustomDatePicker
                            startDate={filters.startDate}
                            endDate={filters.endDate}
                            onChange={handleDateRangeChange}
                        />
                    </div>

                    {/* Account Selector */}
                    <div className="mt-5">
                        <div className="bg-black border border-[#262626] rounded-full px-4 py-2 flex items-center gap-2 h-[42px]">
                            <select
                                value={filters.account}
                                onChange={(e) => setFilters({ ...filters, account: e.target.value })}
                                className="bg-transparent text-xs font-bold text-[#a1a1aa] focus:outline-none uppercase w-full"
                            >
                                {accountOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* PnL Type Toggle */}
                    <div className="mt-5">
                        <div className="bg-black border border-[#262626] rounded-full p-1 flex h-[42px] items-center">
                            <button
                                onClick={() => setFilters({ ...filters, pnlType: 'GROSS' })}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all h-full flex items-center ${filters.pnlType === 'GROSS' ? 'bg-[#262626] text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
                            >
                                GROSS
                            </button>
                            <button
                                onClick={() => setFilters({ ...filters, pnlType: 'NET' })}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all h-full flex items-center ${filters.pnlType === 'NET' ? 'bg-[#262626] text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'}`}
                            >
                                NET
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Updated Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* 1. P&L */}
                <StatCard
                    title={`${filters.pnlType} P&L`}
                    value={`₹${stats ? (stats.total_pnl / 100000).toFixed(2) + 'L' : '0'}`}
                    valueColor={stats?.total_pnl >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}
                >
                    <div className="mt-auto grid grid-cols-1 gap-2 text-[10px]">
                        <div className="flex justify-between items-center bg-[#18181b] p-2 rounded border border-[#262626]">
                            <span className="text-[#a1a1aa]">Brokerage</span>
                            <span className="text-white">₹{stats ? formatINR(stats.total_brokerage) : 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-[#18181b] p-2 rounded border border-[#262626]">
                            <span className="text-[#a1a1aa]">Taxes</span>
                            <span className="text-white">₹{stats ? formatINR(stats.total_taxes) : 0}</span>
                        </div>
                    </div>
                </StatCard>

                {/* 2. Drawdown */}
                <StatCard
                    title="CURRENT DRAWDOWN"
                    value={stats?.drawdown === 0 ? "PEAK HIGH" : `-₹${stats ? formatINR(Math.abs(stats.drawdown)) : 0}`}
                    valueColor={stats?.drawdown === 0 ? "text-[#4ade80]" : "text-[#f87171]"}
                >
                    <div className="mt-auto grid grid-cols-1 gap-2 text-[10px]">
                        {stats?.drawdown === 0 ? (
                            <div className="flex items-center gap-2 text-[#4ade80] font-bold text-sm bg-[#4ade80]/10 p-2 rounded justify-center h-full">
                                <span>ALL time high!</span>
                                <span className="text-xl">🙂</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center text-[#a1a1aa]">
                                    <span>Distance from Peak</span>
                                    <span className="text-[#f87171]">{stats ? ((stats.drawdown / (stats.total_pnl - stats.drawdown)) * 100).toFixed(1) : 0}%</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-[#262626] pt-1 mt-1">
                                    <span className="text-[#a1a1aa]">Last ATH</span>
                                    <span className="text-white">{stats?.last_ath_date ? format(new Date(stats.last_ath_date), 'dd MMM yy') : '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[#a1a1aa]">Days in DD</span>
                                    <span className="text-white">{stats?.days_in_dd || 0} Days</span>
                                </div>
                            </>
                        )}
                    </div>
                </StatCard>

                {/* 3. Consolidated Win Rate Card */}
                <WinRateCard
                    daily={{
                        rate: stats?.win_rate || 0,
                        wins: stats?.profit_days || 0,
                        losses: stats?.loss_days || 0,
                        total: stats?.total_days_logged || 0
                    }}
                    weekly={{
                        rate: stats?.weekly_win_rate || 0,
                        wins: stats?.weekly_profit_count || 0,
                        losses: stats?.weekly_loss_count || 0,
                        total: stats?.total_weeks || 0
                    }}
                    monthly={{
                        rate: stats?.monthly_win_rate || 0,
                        wins: stats?.monthly_profit_count || 0,
                        losses: stats?.monthly_loss_count || 0,
                        total: stats?.total_months || 0
                    }}
                />

                {/* 6. Best & Worst Day */}
                <StatCard
                    title="BEST & WORST DAY"
                    value="" // No single big value, custom layout
                    valueColor="text-white"
                >
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="flex flex-col">
                            <span className="text-[#a1a1aa] text-[10px] uppercase font-bold mb-1">Best Day</span>
                            <div className="flex justify-between items-end">
                                <span className="text-[#4ade80] text-xl font-bold">
                                    +₹{stats?.best_day ? formatINR(stats.best_day.pnl) : 0}
                                </span>
                                <span className="text-[#52525b] text-[10px]">
                                    {stats?.best_day ? format(new Date(stats.best_day.date), "MMM do ''yy") : '-'}
                                </span>
                            </div>
                        </div>
                        <div className="h-[1px] bg-[#262626] w-full" />
                        <div className="flex flex-col">
                            <span className="text-[#a1a1aa] text-[10px] uppercase font-bold mb-1">Worst Day</span>
                            <div className="flex justify-between items-end">
                                <span className="text-[#f87171] text-xl font-bold">
                                    {stats?.worst_day ? `₹${formatINR(stats.worst_day.pnl)}` : '0'}
                                </span>
                                <span className="text-[#52525b] text-[10px]">
                                    {stats?.worst_day ? format(new Date(stats.worst_day.date), "MMM do ''yy") : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* Chart Section (Bottom) - Now uses chartData */}
            <div className="space-y-6 mb-8">
                <CombinedPerformanceChart entries={chartData} />

                {/* Timeline Scrollbar */}
                <TimelineScrollbar
                    data={rawEntries}
                    valueKey="pnl"
                    dateKey="date"
                    onRangeChange={(range) => setTimelineRange(range)}
                />
            </div>

            {/* Heatmap Section */}
            <h3 className="text-[#71717a] text-xs font-bold uppercase tracking-wider mb-4 mt-8">Performance Map</h3>
            <TradingHeatmap entries={entries} />

            {/* Feed Section */}
            <div className="mt-8 flex justify-between items-center mb-4">
                <h3 className="text-[#71717a] text-xs font-bold uppercase tracking-wider">Journal Entries</h3>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            setFetchingPnl(true);
                            try {
                                const res = await client.get('/journal/fetch_live_pnl');
                                const data = res.data;
                                setFetchedPnlData(data);
                                if (data.errors && data.errors.length > 0) {
                                    alert(`Some accounts had errors:\n${data.errors.join('\n')}`);
                                }
                                setEditingDate(null);
                                setIsModalOpen(true);
                            } catch (error) {
                                console.error('Failed to fetch live PnL:', error);
                                alert('Failed to fetch live PnL. Is the backend running?');
                            } finally {
                                setFetchingPnl(false);
                            }
                        }}
                        disabled={fetchingPnl}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-black px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {fetchingPnl ? (
                            <><Loader2 size={14} className="animate-spin" /> Fetching...</>
                        ) : (
                            <><Zap size={14} /> Fetch Today's PnL</>
                        )}
                    </button>
                    <button onClick={() => { setFetchedPnlData(null); setIsModalOpen(true); }} className="bg-[#eab308] text-black px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg hover:bg-yellow-400 transition-colors">
                        + Log Day
                    </button>
                </div>
            </div>

            <JournalFeed entries={entries} onEdit={handleEdit} onDelete={handleDelete} />

            <JournalEntryForm
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingDate(null);
                    setFetchedPnlData(null);
                }}
                onSuccess={fetchRawData}
                editingDate={editingDate}
                prefillData={fetchedPnlData}
            />
        </div>
    );
};

export default TradingJournal;
