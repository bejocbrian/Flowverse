import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton.jsx';

export function PageSkeleton() {
	return (
		<div className="flex-1 overflow-y-auto bg-black text-white">
			<div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
				{/* Hero skeleton */}
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
					className="p-8 sm:p-10 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4"
				>
					<Skeleton className="h-8 w-3/12" />
					<Skeleton className="h-4 w-full max-w-md" />
					<Skeleton className="h-4 w-full max-w-lg" />
				</motion.div>

				{/* Stats grid skeleton */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<motion.div
							key={i}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: i * 0.1 }}
							className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-2"
						>
							<Skeleton className="h-4 w-1/4" />
							<Skeleton className="h-8 w-3/4" />
							<Skeleton className="h-3 w-1/3" />
						</motion.div>
					))}
				</div>

				{/* Content grid skeleton */}
				<div className="lg:grid lg:grid-cols-3 gap-8">
					<div className="lg:col-span-2 space-y-6">
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4"
						>
							<Skeleton className="h-5 w-1/4" />
							{Array.from({ length: 3 }).map((_, i) => (
								<Skeleton key={i} className="aspect-video w-full rounded-lg" />
							))}
						</motion.div>
					</div>

					<div className="space-y-6">
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
							className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4"
						>
							<Skeleton className="h-5 w-1/4" />
							{Array.from({ length: 3 }).map((_, i) => (
								<Skeleton key={i} className="h-10 w-full" />
							))}
						</motion.div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default PageSkeleton;