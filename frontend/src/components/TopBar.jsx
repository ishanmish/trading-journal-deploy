import React from 'react';
import { Terminal } from 'lucide-react';

const TopBar = () => {
    return (
        <div className="flex justify-end items-center gap-4 mb-8">
            {/* Terminal Toggle Removed */}

            {/* User Avatar (Top Right) */}
            <div className="w-10 h-10 rounded-full bg-[#fcd34d] flex items-center justify-center font-bold text-black border-2 border-[#1f1f1f] cursor-pointer">
                IM
            </div>
        </div>
    );
};

export default TopBar;
