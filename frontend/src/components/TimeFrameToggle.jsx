import React from 'react';
import { motion } from 'framer-motion';

const TimeFrameToggle = ({ activeTab, onToggle }) => {
    const tabs = ['DAY', 'MONTH', 'YEAR'];

    return (
        <div className="bg-black border border-[#262626] rounded-full p-1 flex items-center w-fit">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    onClick={() => onToggle(tab)}
                    className={`relative px-6 py-2 rounded-full text-xs font-bold transition-colors ${activeTab === tab ? 'text-white' : 'text-[#52525b] hover:text-[#a1a1aa]'
                        }`}
                >
                    {activeTab === tab && (
                        <motion.div
                            layoutId="active-pill"
                            className="absolute inset-0 bg-[#262626] rounded-full"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10">{tab}</span>
                </button>
            ))}
        </div>
    );
};

export default TimeFrameToggle;
