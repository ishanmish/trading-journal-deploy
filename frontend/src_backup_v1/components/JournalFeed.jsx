import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import MarketContextCard from './MarketContextCard';

const JournalFeed = ({ entries, onEdit, onDelete }) => {
    const [selectedImage, setSelectedImage] = useState(null);

    // Group entries by date
    const groupedByDate = useMemo(() => {
        const groups = {};
        entries.forEach(entry => {
            const dateKey = entry.date.split('T')[0]; // YYYY-MM-DD
            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    accounts: [],
                    totalPnl: 0,
                    notes: null,
                    image_path: null,
                    image_paths: [],
                    twitter_logs: []
                };
            }
            groups[dateKey].accounts.push({
                account_name: entry.account_name,
                pnl: entry.pnl,
                brokerage: entry.brokerage,
                taxes: entry.taxes
            });
            groups[dateKey].totalPnl += entry.pnl;
            if (!groups[dateKey].notes && entry.notes) groups[dateKey].notes = entry.notes;
            if (!groups[dateKey].image_path && entry.image_path) groups[dateKey].image_path = entry.image_path;

            // New Image Paths Logic
            if (entry.image_paths && entry.image_paths.length > 0 && groups[dateKey].image_paths.length === 0) {
                groups[dateKey].image_paths = entry.image_paths;
            } else if (groups[dateKey].image_paths.length === 0 && entry.image_path) {
                // Fallback to legacy single image if no new paths
                groups[dateKey].image_paths = [entry.image_path];
            }

            if (entry.twitter_logs && entry.twitter_logs.length > 0 && groups[dateKey].twitter_logs.length === 0) {
                groups[dateKey].twitter_logs = entry.twitter_logs;
            }
        });
        // Sort by date descending
        return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [entries]);

    const handleDelete = (date) => {
        if (window.confirm(`Are you sure you want to delete the log for ${format(new Date(date), 'MMMM do, yyyy')}?`)) {
            onDelete && onDelete(date);
        }
    };

    return (
        <div className="space-y-4">
            {groupedByDate.map((dayData, index) => (
                <motion.div
                    key={dayData.date}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-all"
                >
                    {/* Header: Date & Total PnL */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white">{format(new Date(dayData.date), 'MMMM do, yyyy')}</h3>
                            {/* Edit & Delete Buttons */}
                            <div className="flex gap-1">
                                <button
                                    onClick={() => onEdit && onEdit(dayData.date)}
                                    className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => handleDelete(dayData.date)}
                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${dayData.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {dayData.totalPnl >= 0 ? '+' : ''}₹{dayData.totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                    </div>

                    {/* Account-wise Breakdown */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {dayData.accounts.map((acc, i) => (
                            <div key={i} className="bg-gray-900 px-3 py-2 rounded text-sm flex items-center gap-2 border border-gray-700">
                                <span className="text-gray-400 font-medium">{acc.account_name}</span>
                                <span className={acc.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {acc.pnl >= 0 ? '+' : ''}₹{acc.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Notes */}
                    {dayData.notes && (
                        <div className="text-gray-300 text-sm mb-4 whitespace-pre-wrap bg-gray-900 p-3 rounded border border-gray-700">
                            {dayData.notes}
                        </div>
                    )}

                    {/* Images Grid */}
                    {dayData.image_paths && dayData.image_paths.length > 0 && (
                        <div className="mb-4">
                            <div className="flex flex-wrap gap-2">
                                {dayData.image_paths.map((path, i) => (
                                    <div
                                        key={i}
                                        className="relative group w-32 h-32 rounded-lg overflow-hidden border border-gray-700 cursor-pointer"
                                        onClick={() => setSelectedImage(path)}
                                    >
                                        <img
                                            src={`http://localhost:8000/${path}`}
                                            alt={`Evidence ${i}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                            onError={(e) => { e.target.style.display = 'none' }}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Market Context */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Market Context</h4>
                        <MarketContextCard date={dayData.date} />
                    </div>

                    {/* Twitter Logs */}
                    {dayData.twitter_logs && dayData.twitter_logs.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Followed Accounts</h4>
                            <div className="flex flex-wrap gap-2">
                                {dayData.twitter_logs.map((log, i) => (
                                    <div key={i} className="bg-gray-900 px-3 py-1 rounded text-xs flex items-center gap-2">
                                        <span className="text-blue-400">@{log.twitter_handle}</span>
                                        <span className={log.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            {log.pnl >= 0 ? '+' : ''}{log.pnl}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            ))}
            {/* Lightbox Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImage(null)}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    >
                        <button
                            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-gray-800/50 p-2 rounded-full"
                        >
                            <X size={24} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={`http://localhost:8000/${selectedImage}`}
                            alt="Full View"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()} // Prevent close on image click
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default JournalFeed;

