import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval,
    startOfWeek, endOfWeek, addYears, subYears
} from 'date-fns';

const CustomDatePicker = ({ startDate, endDate, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    const handleDateClick = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        if (!startDate || (startDate && endDate)) {
            // Start new range
            onChange({ startDate: dateStr, endDate: '' });
        } else {
            // Complete range
            if (new Date(date) < new Date(startDate)) {
                onChange({ startDate: dateStr, endDate: startDate });
            } else {
                onChange({ startDate, endDate: dateStr });
            }
            setIsOpen(false);
        }
    };

    const nextMonth = () => setViewDate(addMonths(viewDate, 1));
    const prevMonth = () => setViewDate(subMonths(viewDate, 1));
    const nextYear = () => setViewDate(addYears(viewDate, 1));
    const prevYear = () => setViewDate(subYears(viewDate, 1));

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewDate)),
        end: endOfWeek(endOfMonth(viewDate))
    });

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        return format(new Date(dateStr), 'd MMM, yyyy');
    };

    return (
        <div className="relative">
            {/* Input Triggers */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-[#a1a1aa] text-xs font-bold mb-1 block">From</label>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="bg-black border border-[#262626] rounded-lg px-4 py-2 w-40 flex items-center justify-between text-sm text-white hover:border-[#404040] transition-colors"
                    >
                        <span>{startDate ? formatDateDisplay(startDate) : 'Select Date'}</span>
                        <CalendarIcon size={16} className="text-[#52525b]" />
                    </button>
                </div>
                <div className="flex-1">
                    <label className="text-[#a1a1aa] text-xs font-bold mb-1 block">To</label>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="bg-black border border-[#262626] rounded-lg px-4 py-2 w-40 flex items-center justify-between text-sm text-white hover:border-[#404040] transition-colors"
                    >
                        <span>{endDate ? formatDateDisplay(endDate) : 'Select Date'}</span>
                        <CalendarIcon size={16} className="text-[#52525b]" />
                    </button>
                </div>
            </div>

            {/* Dropdown Calendar */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full mt-2 left-0 z-50 bg-[#0a0a0a] border border-[#262626] rounded-xl shadow-2xl p-4 w-[320px]"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex gap-1">
                                <button onClick={prevYear} className="p-1 text-[#52525b] hover:text-white"><ChevronsLeft size={16} /></button>
                                <button onClick={prevMonth} className="p-1 text-[#52525b] hover:text-white"><ChevronLeft size={16} /></button>
                            </div>
                            <span className="text-white font-bold">{format(viewDate, 'MMM yyyy')}</span>
                            <div className="flex gap-1">
                                <button onClick={nextMonth} className="p-1 text-[#52525b] hover:text-white"><ChevronRight size={16} /></button>
                                <button onClick={nextYear} className="p-1 text-[#52525b] hover:text-white"><ChevronsRight size={16} /></button>
                            </div>
                        </div>

                        {/* Week Days */}
                        <div className="grid grid-cols-7 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="text-center text-xs text-[#52525b] font-medium py-1">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day, idx) => {
                                const isSelected = (startDate && isSameDay(day, new Date(startDate))) ||
                                    (endDate && isSameDay(day, new Date(endDate)));
                                const isInRange = startDate && endDate &&
                                    isWithinInterval(day, { start: new Date(startDate), end: new Date(endDate) });
                                const isCurrentMonth = isSameMonth(day, viewDate);

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleDateClick(day)}
                                        className={`
                                            h-8 w-8 rounded-full text-sm flex items-center justify-center transition-all
                                            ${!isCurrentMonth ? 'text-[#262626]' : ''}
                                            ${isSelected ? 'bg-[#10b981] text-black font-bold' : ''}
                                            ${isInRange && !isSelected ? 'bg-[#10b981]/10 text-[#10b981]' : ''}
                                            ${!isSelected && !isInRange && isCurrentMonth ? 'text-[#a1a1aa] hover:bg-[#262626] hover:text-white' : ''}
                                        `}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 pt-4 border-t border-[#262626] flex justify-between items-center text-xs text-[#52525b]">
                            <span>Need help?</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomDatePicker;
