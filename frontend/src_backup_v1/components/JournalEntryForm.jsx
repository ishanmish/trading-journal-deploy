import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

const DEFAULT_ACCOUNTS = ["KITE", "GROWW-ME", "GROWW-DAD", "GROWW-MOM"];

const JournalEntryForm = ({ isOpen, onClose, onSuccess, editingDate }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Accounts State
    const [accounts, setAccounts] = useState(
        DEFAULT_ACCOUNTS.map(name => ({
            account_name: name,
            pnl: '',
            brokerage: '',
            taxes: ''
        }))
    );

    // Twitter Logs State
    const [twitterLogs, setTwitterLogs] = useState([]);
    const [newTwitterHandle, setNewTwitterHandle] = useState('');
    const [newTwitterPnl, setNewTwitterPnl] = useState('');

    // Images State
    const [selectedImages, setSelectedImages] = useState([]); // File objects
    const [imagePreviews, setImagePreviews] = useState([]); // URL strings for preview
    const [existingImages, setExistingImages] = useState([]); // URLs from backend when editing

    // Fetch existing data when editing
    useEffect(() => {
        if (editingDate && isOpen) {
            setIsLoading(true);
            axios.get(`http://localhost:8000/journal/daily_log/${editingDate}`)
                .then(res => {
                    const data = res.data;
                    setDate(data.date);
                    setNotes(data.notes || '');
                    setNotes(data.notes || '');
                    setTwitterLogs(data.twitter_logs || []);
                    setExistingImages(data.image_paths || []);
                    setSelectedImages([]);
                    setImagePreviews([]);

                    // Map fetched accounts to form state
                    const updatedAccounts = DEFAULT_ACCOUNTS.map(name => {
                        const existing = data.accounts.find(a => a.account_name === name);
                        return {
                            account_name: name,
                            pnl: existing ? existing.pnl : '',
                            brokerage: existing ? existing.brokerage : '',
                            taxes: existing ? existing.taxes : ''
                        };
                    });
                    setAccounts(updatedAccounts);
                })
                .catch(err => {
                    console.error("Failed to fetch log for editing:", err);
                })
                .finally(() => setIsLoading(false));
        } else if (isOpen && !editingDate) {
            // Reset form for new entry
            setDate(new Date().toISOString().split('T')[0]);
            setNotes('');
            setNotes('');
            setTwitterLogs([]);
            setExistingImages([]);
            setSelectedImages([]);
            setImagePreviews([]);
            setAccounts(DEFAULT_ACCOUNTS.map(name => ({
                account_name: name,
                pnl: '',
                brokerage: '',
                taxes: ''
            })));
        }
    }, [editingDate, isOpen]);

    const handleAccountChange = (index, field, value) => {
        const newAccounts = [...accounts];
        newAccounts[index][field] = value;
        setAccounts(newAccounts);
    };

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        // Unlimited images allowed

        const newImages = [...selectedImages, ...files];
        setSelectedImages(newImages);

        // Generate previews
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImagePreviews([...imagePreviews, ...newPreviews]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const validFiles = files.filter(file => file.type.startsWith('image/'));

            const newImages = [...selectedImages, ...validFiles];
            setSelectedImages(newImages);

            const newPreviews = validFiles.map(file => URL.createObjectURL(file));
            setImagePreviews([...imagePreviews, ...newPreviews]);
        }
    };

    const removeImage = (index, isExisting) => {
        if (isExisting) {
            setExistingImages(existingImages.filter((_, i) => i !== index));
        } else {
            const newImages = selectedImages.filter((_, i) => i !== index);
            const newPreviews = imagePreviews.filter((_, i) => i !== index);
            setSelectedImages(newImages);
            setImagePreviews(newPreviews);
        }
    };

    const addTwitterLog = () => {
        if (newTwitterHandle && newTwitterPnl) {
            setTwitterLogs([...twitterLogs, { twitter_handle: newTwitterHandle, pnl: parseFloat(newTwitterPnl) }]);
            setNewTwitterHandle('');
            setNewTwitterPnl('');
        }
    };

    const removeTwitterLog = (index) => {
        setTwitterLogs(twitterLogs.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const activeAccounts = accounts.filter(a => a.pnl !== '').map(a => ({
            account_name: a.account_name,
            pnl: parseFloat(a.pnl),
            brokerage: a.brokerage ? parseFloat(a.brokerage) : 0,
            taxes: a.taxes ? parseFloat(a.taxes) : 0
        }));

        if (activeAccounts.length === 0 && notes === '') {
            alert("Please enter at least one trade or note.");
            return;
        }

        setIsLoading(true);

        // Upload images first if any
        let uploadedPaths = [...existingImages];
        if (selectedImages.length > 0) {
            const formData = new FormData();
            selectedImages.forEach(img => formData.append('files', img));

            try {
                const uploadRes = await axios.post('http://localhost:8000/journal/upload_images', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                uploadedPaths = [...uploadedPaths, ...uploadRes.data.file_paths];
            } catch (error) {
                console.error("Failed to upload images", error);
                alert("Failed to upload images, but saving log...");
            }
        }

        const payload = {
            date: date,
            notes: notes,
            accounts: activeAccounts,
            twitter_logs: twitterLogs,
            image_paths: uploadedPaths
        };

        try {
            await axios.post('http://localhost:8000/journal/daily_log', payload);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving log", error);
            alert("Failed to save log");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl pointer-events-auto p-6 scrollbar-thin scrollbar-thumb-gray-700">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white">
                                    {editingDate ? 'Edit Trade Day' : 'Log Trade Day'}
                                </h2>
                                <button onClick={onClose} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* Date Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        disabled={!!editingDate}
                                        className={`bg-gray-800 border-gray-700 text-white rounded px-4 py-2 w-full focus:ring-2 focus:ring-blue-500 ${editingDate ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    />
                                </div>

                                {/* Accounts Grid */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-300 mb-4">Account Performance</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {accounts.map((acc, idx) => (
                                            <div key={idx} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                                <input
                                                    type="text"
                                                    value={acc.account_name}
                                                    onChange={(e) => handleAccountChange(idx, 'account_name', e.target.value)}
                                                    className="bg-transparent text-blue-400 font-bold mb-2 border-b border-gray-700 w-full focus:outline-none"
                                                />
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-xs text-gray-500">PnL</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={acc.pnl}
                                                            onChange={(e) => handleAccountChange(idx, 'pnl', e.target.value)}
                                                            className={`bg-gray-900 text-right text-sm rounded px-2 py-1 w-24 focus:ring-1 focus:ring-blue-500 ${acc.pnl > 0 ? 'text-green-400' : acc.pnl < 0 ? 'text-red-400' : 'text-white'}`}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-xs text-gray-500">Brokerage</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={acc.brokerage}
                                                            onChange={(e) => handleAccountChange(idx, 'brokerage', e.target.value)}
                                                            className="bg-gray-900 text-right text-sm rounded px-2 py-1 w-24 text-gray-300 focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-xs text-gray-500">Taxes</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={acc.taxes}
                                                            onChange={(e) => handleAccountChange(idx, 'taxes', e.target.value)}
                                                            className="bg-gray-900 text-right text-sm rounded px-2 py-1 w-24 text-gray-300 focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes Section */}
                                <div>
                                    <label className="block text-lg font-semibold text-gray-300 mb-2">Daily Notes</label>
                                    <textarea
                                        rows={4}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-gray-800 border-gray-700 text-white rounded p-4 focus:ring-2 focus:ring-blue-500"
                                        placeholder="What worked? What didn't? Market conditions..."
                                    />
                                </div>

                                {/* Image Upload Section */}
                                <div>
                                    <label className="block text-lg font-semibold text-gray-300 mb-2">Screenshots</label>
                                    <div className="flex flex-wrap gap-4">
                                        {/* Existing Images */}
                                        {existingImages.map((src, i) => (
                                            <div key={`existing-${i}`} className="relative group w-32 h-32 rounded-lg overflow-hidden border border-gray-600">
                                                <img src={`http://localhost:8000/${src}`} alt="Evidence" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(i, true)}
                                                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* New Image Previews */}
                                        {imagePreviews.map((src, i) => (
                                            <div key={`new-${i}`} className="relative group w-32 h-32 rounded-lg overflow-hidden border border-gray-600">
                                                <img src={src} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(i, false)}
                                                    className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Upload Button */}
                                        <label
                                            className="w-20 h-20 md:w-32 md:h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:text-blue-400 text-gray-400 transition-colors"
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                        >
                                            <Upload size={24} className="mb-2" />
                                            <span className="text-xs text-center px-2">Add or Drop</span>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageSelect}
                                            />
                                        </label>
                                    </div>
                                </div>
                                {/* Twitter Logs Section */}
                                <div>
                                    <label className="block text-lg font-semibold text-gray-300 mb-2">Twitter/External PnLs</label>
                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            placeholder="@username"
                                            value={newTwitterHandle}
                                            onChange={(e) => setNewTwitterHandle(e.target.value)}
                                            className="bg-gray-800 border-gray-700 text-white rounded px-4 py-2 flex-grow focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                            type="number"
                                            placeholder="PnL %"
                                            value={newTwitterPnl}
                                            onChange={(e) => setNewTwitterPnl(e.target.value)}
                                            className="bg-gray-800 border-gray-700 text-white rounded px-4 py-2 w-32 focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={addTwitterLog}
                                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        {twitterLogs.map((log, i) => (
                                            <div key={i} className="bg-gray-800 px-3 py-2 rounded-lg flex items-center gap-3 border border-gray-700">
                                                <span className="text-blue-400 font-medium">@{log.twitter_handle}</span>
                                                <span className={log.pnl >= 0 ? 'text-green-400 structure' : 'text-red-400'}>
                                                    {log.pnl}%
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTwitterLog(i)}
                                                    className="text-gray-500 hover:text-red-400"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 flex justify-end">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="submit"
                                        disabled={isLoading}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/25 disabled:opacity-50"
                                    >
                                        {isLoading ? 'Loading...' : (editingDate ? 'Update Log' : 'Save Day Log')}
                                    </motion.button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default JournalEntryForm;
