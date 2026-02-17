import React from 'react';
import {
    User, Wallet, List, Layers, LayoutDashboard,
    LifeBuoy, LogOut, ChevronRight
} from 'lucide-react';

const Sidebar = () => {
    return (
        <div className="w-64 h-screen bg-[#050505] border-r border-[#262626] flex flex-col justify-between fixed left-0 top-0 overflow-y-auto">
            {/* Logo Section */}
            <div className="p-6">
                <div className="w-10 h-10 bg-[#eab308] rounded-full flex items-center justify-center font-bold text-black text-xl mb-6">
                    IM
                </div>

                {/* Profile Info */}
                <div className="mb-8">
                    <h2 className="text-white font-semibold text-lg">Ishan Mishra</h2>
                    <p className="text-[#a1a1aa] text-sm">ishanmish@gmail.com</p>
                </div>

                {/* Profile Menu */}
                <div className="mb-2">
                    <h3 className="text-[#52525b] text-xs font-bold uppercase tracking-wider mb-4">Profile</h3>
                    <nav className="space-y-1">
                        <NavItem icon={<User size={18} />} label="Account Details" />
                        <NavItem icon={<Wallet size={18} />} label="Balance" value="₹53.20L" />
                        <NavItem icon={<List size={18} />} label="All Orders" />
                    </nav>
                </div>

                {/* Tools Menu */}
                <div className="mt-8">
                    <h3 className="text-[#52525b] text-xs font-bold uppercase tracking-wider mb-4">Tools</h3>
                    <nav className="space-y-1">
                        <NavItem icon={<Layers size={18} />} label="Strategy Builder" />
                        <NavItem icon={<LayoutDashboard size={18} />} label="P&L Dashboard" active />
                    </nav>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="p-6 border-t border-[#262626]">
                <nav className="space-y-1">
                    <NavItem icon={<LifeBuoy size={18} />} label="Support & FAQs" />
                    <NavItem icon={<LogOut size={18} className="text-[#f87171]" />} label="Logout" className="text-[#f87171] hover:text-[#f87171] hover:bg-[#f87171]/10" />
                </nav>
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, value, active, className }) => {
    return (
        <a
            href="#"
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group
            ${active
                    ? 'bg-[#262626] text-white'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#1f1f1f]'}
            ${className || ''}
            `}
        >
            <div className="flex items-center gap-3">
                {icon}
                <span>{label}</span>
            </div>
            {value && (
                <span className="bg-[#262626] text-[#ededed] px-2 py-0.5 rounded textxs">{value}</span>
            )}
        </a>
    );
};

export default Sidebar;
