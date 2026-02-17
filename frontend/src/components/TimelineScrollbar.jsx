import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';

const formatDisplayDate = (value) => {
    if (!value) return '—';
    const raw = String(value);
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const dt = isIsoDate ? new Date(`${raw}T00:00:00`) : new Date(raw);
    if (isNaN(dt.getTime())) return raw;
    return format(dt, 'dd/MM/yyyy');
};

const TimelineScrollbar = ({
    data,
    valueKey = 'pnl',
    dateKey = 'date',
    onRangeChange
}) => {
    const timelineRef = useRef(null);
    const brushRafRef = useRef(null);
    const dragSnapshotRef = useRef(null);
    const [brushRange, setBrushRange] = useState({ startIndex: 0, endIndex: 0 });
    const [dragMode, setDragMode] = useState(null); // move | start | end | null

    // Ensure data is sorted and mapped
    const rangeDomainDaily = useMemo(() => {
        if (!data || data.length === 0) return [];
        return [...data].sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
    }, [data, dateKey]);

    const rangeMax = Math.max(0, (rangeDomainDaily?.length || 1) - 1);
    const minSpan = Math.min(rangeMax, Math.max(4, Math.floor((rangeMax + 1) * 0.04)));

    // Initialize full range
    useEffect(() => {
        if (rangeDomainDaily.length > 0) {
            setBrushRange({ startIndex: 0, endIndex: rangeMax });
        }
    }, [rangeMax]);

    const emitRangeChange = useCallback((startIndex, endIndex) => {
        if (!onRangeChange) return;
        const from = rangeDomainDaily[startIndex]?.[dateKey];
        const to = rangeDomainDaily[endIndex]?.[dateKey];

        if (!from || !to) return;

        if (brushRafRef.current) cancelAnimationFrame(brushRafRef.current);
        brushRafRef.current = requestAnimationFrame(() =>
            onRangeChange({
                start: new Date(from),
                end: new Date(to)
            })
        );
    }, [rangeDomainDaily, onRangeChange, dateKey]);

    const setRangeAndEmit = useCallback((nextStart, nextEnd) => {
        if (nextStart > nextEnd) return;
        setBrushRange(prev => {
            if (prev.startIndex === nextStart && prev.endIndex === nextEnd) return prev;
            return { startIndex: nextStart, endIndex: nextEnd };
        });
        emitRangeChange(nextStart, nextEnd);
    }, [emitRangeChange]);

    const beginTimelineDrag = useCallback((mode, event) => {
        if (!rangeDomainDaily?.length || rangeMax <= 0) return;
        const rect = timelineRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        event.preventDefault();
        event.stopPropagation();
        dragSnapshotRef.current = {
            startX: event.clientX,
            width: rect.width,
            startIndex: brushRange.startIndex,
            endIndex: brushRange.endIndex
        };
        setDragMode(mode);
    }, [brushRange, rangeDomainDaily, rangeMax]);

    useEffect(() => {
        if (!dragMode) return undefined;
        const onMove = (event) => {
            const snap = dragSnapshotRef.current;
            if (!snap || !snap.width || rangeMax <= 0) return;
            const dx = event.clientX - snap.startX;
            const pxPerDay = snap.width / Math.max(1, rangeMax);
            const deltaIdx = Math.round(dx / pxPerDay);
            const span = Math.max(0, snap.endIndex - snap.startIndex);

            if (dragMode === 'move') {
                const nextStart = Math.max(0, Math.min(snap.startIndex + deltaIdx, Math.max(0, rangeMax - span)));
                const nextEnd = Math.min(rangeMax, nextStart + span);
                setRangeAndEmit(nextStart, nextEnd);
            } else if (dragMode === 'start') {
                const nextStart = Math.max(0, Math.min(snap.startIndex + deltaIdx, snap.endIndex - minSpan));
                setRangeAndEmit(nextStart, snap.endIndex);
            } else if (dragMode === 'end') {
                const nextEnd = Math.min(rangeMax, Math.max(snap.endIndex + deltaIdx, snap.startIndex + minSpan));
                setRangeAndEmit(snap.startIndex, nextEnd);
            }
        };
        const onUp = () => setDragMode(null);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragMode, minSpan, rangeMax, setRangeAndEmit]);

    const selectedSpan = Math.max(0, brushRange.endIndex - brushRange.startIndex);
    const leftPct = rangeMax > 0 ? (brushRange.startIndex / rangeMax) * 100 : 0;
    const widthPct = rangeMax > 0 ? (selectedSpan / rangeMax) * 100 : 100;

    const rangeFromDate = formatDisplayDate(rangeDomainDaily?.[brushRange.startIndex]?.[dateKey]);
    const rangeToDate = formatDisplayDate(rangeDomainDaily?.[brushRange.endIndex]?.[dateKey]);

    // Sparkline Points
    const timelinePoints = useMemo(() => {
        if (!rangeDomainDaily?.length) return '';
        const vals = rangeDomainDaily.map(d => Number(d[valueKey] ?? 0));
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const span = maxV - minV || 1;
        return vals.map((v, i) => {
            const x = rangeMax > 0 ? (i / rangeMax) * 100 : 0;
            // Invert Y so higher values are higher up
            const y = 100 - ((v - minV) / span) * 100;
            return `${x},${y}`;
        }).join(' ');
    }, [rangeDomainDaily, valueKey, rangeMax]);

    if (!rangeDomainDaily || rangeDomainDaily.length === 0) {
        return (
            <div className="mt-6 p-4 border border-gray-700 rounded-xl bg-gray-900 text-gray-400 text-center text-sm">
                No timeline data available
            </div>
        );
    }

    return (
        <div className="mt-4 w-full select-none">
            {/* Slider Track */}
            <div className="rounded-lg border border-gray-800 bg-gray-950 relative h-8 w-full overflow-hidden">
                <div ref={timelineRef} className="relative h-full w-full">
                    {/* Sparkline Line */}
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <polyline
                            points={timelinePoints}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="1.2"
                            vectorEffect="non-scaling-stroke"
                            opacity="0.5"
                        />
                    </svg>

                    {/* Draggable Window */}
                    <div
                        className={`absolute top-0 h-full border-l border-r border-blue-500 bg-blue-500/10 ${dragMode ? 'cursor-grabbing' : 'cursor-grab'} group`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(2, widthPct)}%` }}
                        onMouseDown={(e) => beginTimelineDrag('move', e)}
                        role="slider"
                        aria-label="Date range window"
                    >
                        {/* Hover/Active overlay for better visibility */}
                        <div className="absolute inset-0 bg-blue-400/5 group-hover:bg-blue-400/10 transition-colors" />

                        {/* Left Handle */}
                        <div
                            className="absolute left-0 top-0 h-full w-3 -ml-1.5 cursor-ew-resize hover:bg-blue-500/50 z-10 transition-colors"
                            onMouseDown={(e) => beginTimelineDrag('start', e)}
                        />
                        {/* Right Handle */}
                        <div
                            className="absolute right-0 top-0 h-full w-3 -mr-1.5 cursor-ew-resize hover:bg-blue-500/50 z-10 transition-colors"
                            onMouseDown={(e) => beginTimelineDrag('end', e)}
                        />
                    </div>
                </div>
            </div>

            {/* Dynamic Date Label Below */}
            <div className="mt-2 text-center">
                <span className="text-xs font-mono text-gray-400 bg-gray-900/50 px-2 py-1 rounded border border-gray-800">
                    {rangeFromDate} — {rangeToDate}
                </span>
            </div>
        </div>
    );
};

export default TimelineScrollbar;
