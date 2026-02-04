import React from 'react';

const StatCard = ({ title, value, valueColor, subStats, children }) => {
    return (
        <div className="bg-[#0f0f0f] border border-[#262626] rounded-3xl p-6 flex flex-col justify-between min-h-[12rem] h-auto relative overflow-hidden group hover:border-[#333] transition-colors">

            <div className="flex justify-between items-start">
                <h3 className="text-[#71717a] text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
                {/* Optional Top Right Icon/Indicator */}
            </div>

            <div className={`text-3xl font-bold ${valueColor || 'text-white'} mb-4`}>
                {value}
            </div>

            {/* Sub Stats Grid or Children */}
            {children ? children : (
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mt-auto">
                    {subStats && subStats.map((stat, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[#a1a1aa]">
                            <span>{stat.label}</span>
                            <span className="text-white font-medium">{stat.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StatCard;
