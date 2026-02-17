import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Module-level cache - persists across re-renders and component unmounts
const marketContextCache = {};

const MarketContextCard = ({ date }) => {
    const [data, setData] = useState(() => marketContextCache[date] || null);
    const [loading, setLoading] = useState(() => !marketContextCache[date]);

    useEffect(() => {
        // If already cached, use cached data immediately
        if (marketContextCache[date]) {
            setData(marketContextCache[date]);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const res = await fetch(`${API_URL}/journal/market_context/${date}`);
                if (res.ok) {
                    const json = await res.json();
                    // Store in cache
                    marketContextCache[date] = json;
                    setData(json);
                }
            } catch (e) {
                console.error('Failed to fetch market context:', e);
                // Cache the error state too to avoid re-fetching
                marketContextCache[date] = { 'NIFTY 50': { status: 'error' }, 'SENSEX': { status: 'error' } };
                setData(marketContextCache[date]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [date]);

    const renderIndex = (name, indexData) => {
        if (!indexData || indexData.status === 'no_data') {
            return (
                <div className="min-w-[180px] bg-gray-900 rounded border border-gray-700 p-3 flex flex-col">
                    <span className="text-gray-400 font-medium text-sm">{name}</span>
                    <span className="text-gray-600 text-xs mt-1">Market Closed</span>
                </div>
            );
        }
        if (indexData.status === 'error') {
            return (
                <div className="min-w-[180px] bg-gray-900 rounded border border-gray-700 p-3 flex flex-col">
                    <span className="text-gray-400 font-medium text-sm">{name}</span>
                    <span className="text-red-400 text-xs mt-1">Error loading</span>
                </div>
            );
        }

        const isPositive = indexData.change >= 0;
        return (
            <div className="min-w-[180px] bg-gray-900 rounded border border-gray-700 p-3 flex flex-col">
                <span className="text-gray-400 font-medium text-sm mb-1">{name}</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-white font-bold text-lg">
                        {indexData.close.toLocaleString('en-IN')}
                    </span>
                    <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{indexData.change.toLocaleString('en-IN')} ({isPositive ? '+' : ''}{indexData.change_pct}%)
                    </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    Open: {indexData.open.toLocaleString('en-IN')}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex gap-4">
                <div className="min-w-[180px] h-20 bg-gray-900 rounded border border-gray-700 animate-pulse" />
                <div className="min-w-[180px] h-20 bg-gray-900 rounded border border-gray-700 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-2">
            {renderIndex('NIFTY 50', data?.['NIFTY 50'])}
            {renderIndex('SENSEX', data?.['SENSEX'])}
        </div>
    );
};

export default MarketContextCard;
