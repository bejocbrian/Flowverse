import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { motion } from 'framer-motion';
import {
	LayoutDashboard,
	Wand2,
	Video,
	ListTodo,
	BarChart3,
	Wallet,
	ArrowLeft,
	CreditCard,
	Settings,
	LogOut,
	User,
	Moon,
	Sun,
} from 'lucide-react';

const navItems = [
	{ icon: LayoutDashboard, label: 'Dashboard', path: '/app/dashboard' },
	{ icon: Wand2, label: 'Workspace', path: '/app/generate' },
	{ icon: Video, label: 'Library', path: '/app/library' },
	{ icon: ListTodo, label: 'Queue', path: '/app/queue' },
	{ icon: BarChart3, label: 'Analytics', path: '/app/analytics' },
	{ icon: Wallet, label: 'Wallet', path: '/app/wallet' },
];

const MainLayout = ({ children }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const { currentUser, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();

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
						<ArrowLeft className="w-5 h-5" />
					</button>
					<button
						onClick={() => navigate('/app/dashboard')}
						className="text-sm font-semibold tracking-tight whitespace-nowrap hover:opacity-80"
					>
						FlowVerse
					</button>
				</div>

				<div className="flex-1" />

				<div className="flex items-center gap-2 min-w-[200px] justify-end">
					<button
						onClick={toggleTheme}
						className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60"
						aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
					</button>
					<button
						onClick={() => navigate('/app/wallet')}
						className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium hover:bg-white/5 transition-all"
						aria-label="Credits balance"
					>
						<CreditCard className="w-4 h-4 text-yellow-300" />
						<span>{currentUser?.credits_balance ?? 0}</span>
					</button>
					<button
						onClick={() => navigate('/app/settings')}
						className="p-2 hover:bg-white/10 rounded-full transition-all text-white/60"
						aria-label="Settings"
					>
						<Settings className="w-5 h-5" />
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
								<Settings className="w-4 h-4" />
								Settings
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={logout}
								className="hover:bg-white/5 cursor-pointer py-2 px-4 flex items-center gap-2 text-red-400"
							>
								<LogOut className="w-4 h-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				<nav className="w-16 flex flex-col items-center py-6 gap-3 border-r border-white/5 shrink-0">
					{navItems.map((item) => {
						const Icon = item.icon;
						return (
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
								<Icon className="w-6 h-6" />
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
						);
					})}
				</nav>

				<main id="main-content" className="flex-1 overflow-auto flex flex-col relative bg-black">{children}</main>
			</div>
		</div>
	);
};

export default MainLayout;
