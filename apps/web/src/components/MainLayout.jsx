import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { motion } from 'framer-motion';

const navItems = [
	{ icon: 'dashboard', label: 'Dashboard', path: '/app/dashboard' },
	{ icon: 'auto_awesome', label: 'Workspace', path: '/app/generate' },
	{ icon: 'video_library', label: 'Library', path: '/app/library' },
	{ icon: 'analytics', label: 'Analytics', path: '/app/analytics' },
	{ icon: 'account_balance_wallet', label: 'Wallet', path: '/app/wallet' },
];

const MainLayout = ({ children }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const { currentUser, logout } = useAuth();

	const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

	return (
		<div className="min-h-screen bg-black text-white flex flex-col font-sans overflow-hidden">
			<header className="h-16 flex items-center justify-between px-6 z-50 border-b border-white/5">
				<div className="flex items-center gap-3 min-w-[200px]">
					<button
						onClick={() => navigate(-1)}
						className="p-2 hover:bg-white/10 rounded-full transition-all"
						aria-label="Back"
					>
						<span className="material-symbols-outlined text-xl">arrow_back</span>
					</button>
					<button
						onClick={() => navigate('/app/dashboard')}
						className="text-sm font-semibold tracking-tight whitespace-nowrap hover:opacity-80"
					>
						Aether Video
					</button>
				</div>

				<div className="flex-1 max-w-2xl px-4">
					<div className="relative group">
						<input
							type="text"
							placeholder="Search or ask anything"
							className="w-full bg-[#1a1b1e] border border-white/5 rounded-full py-2.5 pl-12 pr-4 text-sm focus:bg-[#25262b] focus:border-white/20 transition-all outline-none"
						/>
						<span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/60">
							search
						</span>
					</div>
				</div>

				<div className="flex items-center gap-2 min-w-[200px] justify-end">
					<button
						onClick={() => navigate('/app/wallet')}
						className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium hover:bg-white/5 transition-all"
						aria-label="Credits balance"
					>
						<span className="material-symbols-outlined text-base text-yellow-300">paid</span>
						<span>{currentUser?.credits_balance ?? 0}</span>
					</button>
					<button
						onClick={() => navigate('/app/settings')}
						className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60"
						aria-label="Settings"
					>
						<span className="material-symbols-outlined text-xl">settings</span>
					</button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								className="ml-1 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold ring-2 ring-transparent hover:ring-white/20 transition-all"
								aria-label="Account menu"
							>
								{currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="bg-[#1a1b1e] border border-white/10 text-white rounded-xl w-56"
						>
							<div className="px-4 py-3 border-b border-white/5">
								<p className="text-sm font-semibold truncate">{currentUser?.name}</p>
								<p className="text-xs text-white/40 truncate">{currentUser?.email}</p>
							</div>
							<DropdownMenuItem
								onClick={() => navigate('/app/settings')}
								className="hover:bg-white/5 cursor-pointer py-2 px-4 flex items-center gap-2"
							>
								<span className="material-symbols-outlined text-lg">settings</span>
								Settings
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={logout}
								className="hover:bg-white/5 cursor-pointer py-2 px-4 flex items-center gap-2 text-red-400"
							>
								<span className="material-symbols-outlined text-lg">logout</span>
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				<nav className="w-16 flex flex-col items-center py-6 gap-3 border-r border-white/5 shrink-0">
					{navItems.map((item) => (
						<button
							key={item.path}
							onClick={() => navigate(item.path)}
							title={item.label}
							className={`p-2 rounded-xl transition-all duration-300 relative group ${
								isActive(item.path)
									? 'bg-white/10 text-white'
									: 'text-white/40 hover:text-white hover:bg-white/5'
							}`}
							aria-label={item.label}
						>
							<span className="material-symbols-outlined text-[26px]">{item.icon}</span>
							{isActive(item.path) && (
								<motion.div
									layoutId="activeNav"
									className="absolute left-[-1px] top-1/4 bottom-1/4 w-[3px] bg-white rounded-r-full"
								/>
							)}
							<div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#1a1b1e] text-xs font-medium rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100]">
								{item.label}
							</div>
						</button>
					))}
				</nav>

				<main className="flex-1 overflow-auto flex flex-col relative bg-black">{children}</main>
			</div>
		</div>
	);
};

export default MainLayout;
