import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import PerformanceHeader from '../components/PerformanceHeader';
import JournalEntryForm from '../components/JournalEntryForm';
import JournalFeed from '../components/JournalFeed';

const TradingJournal = () => {
    const [stats, setStats] = useState(null);
    const [rawEntries, setRawEntries] = useState([]); // Store raw data
    const [entries, setEntries] = useState([]); // Display data (filtered/processed)
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDate, setEditingDate] = useState(null); // Date being edited, null for new entry

    // Filter States
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        account: '',
        pnlType: 'NET' // GROSS or NET
    });

    const fetchRawData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.account && filters.account !== 'ALL') params.account = filters.account;

            const [statsRes, entriesRes] = await Promise.all([
                axios.get('http://localhost:8000/journal/stats'),
                axios.get('http://localhost:8000/journal/entries', { params })
            ]);

            setRawEntries(entriesRes.data);
            setStats(statsRes.data); // Initial stats might be global, filtering updates stats below

        } catch (error) {
            console.error("Error fetching journal data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRawData();
    }, [filters.startDate, filters.endDate, filters.account]);

    // Process Data (Gross vs Net)
    useEffect(() => {
        const processed = rawEntries.map(e => {
            let effectivePnL = e.pnl;
            if (filters.pnlType === 'NET') {
                effectivePnL = e.pnl - (e.brokerage || 0) - (e.taxes || 0);
            }
            return { ...e, pnl: effectivePnL };
        });
        setEntries(processed);

        // Recalculate Stats for the view
        const totalPnL = processed.reduce((sum, e) => sum + e.pnl, 0);
        const totalBrokerage = rawEntries.reduce((sum, e) => sum + (e.brokerage || 0), 0);
        const totalTaxes = rawEntries.reduce((sum, e) => sum + (e.taxes || 0), 0);

        // Note: Simple count of positive entries. Daily win rate logic is handled differently in backend stats.
        const wins = processed.filter(e => e.pnl > 0).length;
        const total = processed.length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;

        setStats(prev => ({
            ...prev,
            total_pnl: totalPnL,
            total_brokerage: totalBrokerage,
            total_taxes: totalTaxes,
            win_rate: total > 0 ? winRate : (prev?.win_rate || 0),
            total_days_logged: total,
        }));

    }, [rawEntries, filters.pnlType]);

    const accountOptions = ["ALL", "KITE", "GROWW-ME", "GROWW-DAD", "GROWW-MOM"];

    // Edit handler - opens modal with existing date
    const handleEdit = (date) => {
        setEditingDate(date);
        setIsModalOpen(true);
    };

    // Delete handler - calls API and refreshes
    const handleDelete = async (date) => {
        try {
            await axios.delete(`http://localhost:8000/journal/daily_log/${date}`);
            fetchRawData(); // Refresh data
        } catch (error) {
            console.error("Error deleting log:", error);
            alert("Failed to delete log. Please try again.");
        }
    };

    return (
        <div className="p-8 text-white min-h-screen bg-gray-900 font-sans">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    Trading Journal
                </h1>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Filters Bar */}
                    <div className="bg-gray-800 p-1 rounded-lg flex items-center gap-2 border border-gray-700">
                        <select
                            value={filters.account}
                            onChange={(e) => setFilters({ ...filters, account: e.target.value })}
                            className="bg-transparent text-sm text-gray-300 px-2 py-1 focus:outline-none"
                        >
                            {accountOptions.map(opt => <option key={opt} value={opt}>{opt === 'ALL' ? 'All Accounts' : opt}</option>)}
                        </select>
                        <div className="h-4 w-[1px] bg-gray-600"></div>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="bg-transparent text-sm text-gray-300 px-2 py-1 focus:outline-none w-32"
                            placeholder="Start"
                        />
                        <span className="text-gray-500">-</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="bg-transparent text-sm text-gray-300 px-2 py-1 focus:outline-none w-32"
                        />
                    </div>

                    <div className="bg-gray-800 p-1 rounded-lg flex items-center border border-gray-700">
                        <button
                            onClick={() => setFilters({ ...filters, pnlType: 'GROSS' })}
                            className={`px-3 py-1 text-xs font-semibold rounded ${filters.pnlType === 'GROSS' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            GROSS
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, pnlType: 'NET' })}
                            className={`px-3 py-1 text-xs font-semibold rounded ${filters.pnlType === 'NET' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            NET
                        </button>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 text-sm ml-2"
                    >
                        + Log
                    </motion.button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">Loading...</div>
            ) : (
                <>
                    <PerformanceHeader stats={stats} entries={entries} />

                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4 text-gray-300">
                            {filters.account && filters.account !== 'ALL' ? filters.account : 'All Accounts'} Logs
                            <span className="text-xs font-normal text-gray-500 ml-2">({filters.pnlType})</span>
                        </h2>
                        <JournalFeed
                            entries={entries}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    </div>
                </>
            )}

            <JournalEntryForm
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingDate(null);
                }}
                onSuccess={fetchRawData}
                editingDate={editingDate}
            />
        </div>
    );
};

export default TradingJournal;
