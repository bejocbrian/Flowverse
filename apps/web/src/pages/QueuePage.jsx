import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Video,
  XCircle,
  Zap,
  ListVideo,
} from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';

const POLL_INTERVAL = 8000; // 8 seconds while page is open

const STATUS_CONFIG = {
  queued:     { label: 'Queued',      icon: Clock,         color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  generating: { label: 'Generating',  icon: Zap,           color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  processing: { label: 'Processing',  icon: Loader2,       color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  completed:  { label: 'Completed',   icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  failed:     { label: 'Failed',      icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10' },
  cancelled:  { label: 'Cancelled',   icon: XCircle,       color: 'text-white/30',    bg: 'bg-white/5' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono ${cfg.bg} ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${status === 'generating' || status === 'processing' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
};

const QueuePage = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState('active'); // 'active' | 'all'

  const fetchQueue = useCallback(async (pg = 1, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const statusFilter = activeFilter === 'active'
        ? '&status=queued,generating,processing'
        : '';
      const res = await apiServerClient.fetch(
        `/videos?page=${pg}&perPage=20&sort=-created${statusFilter}`
      );
      if (!res.ok) throw new Error('Failed to fetch queue');
      const data = await res.json();

      setVideos(data.items || []);
      setTotalPages(data.totalPages || 1);
      setPage(data.currentPage || 1);
    } catch (err) {
      if (!silent) toast.error(err.message || 'Failed to load queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  // Initial load + filter change
  useEffect(() => {
    fetchQueue(1);
  }, [fetchQueue]);

  // Auto-refresh while active generations exist
  useEffect(() => {
    const hasActive = videos.some(
      (v) => v.status === 'queued' || v.status === 'generating' || v.status === 'processing'
    );
    if (!hasActive) return;

    const timer = setInterval(() => fetchQueue(page, true), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [videos, page, fetchQueue]);

  const handleRefresh = () => fetchQueue(page, true);

  const activeCount = videos.filter(
    (v) => v.status === 'queued' || v.status === 'generating' || v.status === 'processing'
  ).length;

  return (
    <>
      <Helmet>
        <title>Queue — FlowVerse</title>
      </Helmet>

      <div className="flex flex-col gap-6 px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ListVideo className="w-6 h-6 text-[hsl(var(--accent-primary))]" />
              Generation Queue
            </h1>
            {activeCount > 0 && (
              <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
                {activeCount} video{activeCount !== 1 ? 's' : ''} in progress
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-[hsl(var(--elevated))] p-1 rounded-xl w-fit">
          {['active', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeFilter === f
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--text-primary))] shadow-sm'
                  : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
              }`}
            >
              {f === 'active' ? 'In Progress' : 'All'}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--text-secondary))]" />
          </div>
        ) : videos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--elevated))] flex items-center justify-center mb-4">
              <Video className="w-7 h-7 text-[hsl(var(--text-secondary))]" />
            </div>
            <p className="text-[hsl(var(--text-secondary))]">
              {activeFilter === 'active'
                ? 'No generations in progress'
                : 'No videos yet'}
            </p>
            <Link
              to="/app/generate"
              className="mt-4 px-4 py-2 rounded-lg bg-[hsl(var(--accent-primary))] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Generate your first video
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="flex flex-col gap-3">
              {videos.map((video) => (
                <motion.div
                  key={video.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex items-start gap-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-4 hover:border-[hsl(var(--border-hover))] transition-colors"
                >
                  {/* Thumbnail or placeholder */}
                  <div className="w-20 h-12 rounded-lg bg-[hsl(var(--elevated))] flex items-center justify-center shrink-0 overflow-hidden border border-[hsl(var(--border))]">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt="thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-5 h-5 text-[hsl(var(--text-secondary))]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium truncate">
                        {video.prompt || '(no prompt)'}
                      </p>
                      <StatusBadge status={video.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[hsl(var(--text-secondary))] font-mono">
                      <span>{video.model || '—'}</span>
                      <span className="opacity-40">·</span>
                      <span>{video.quality || '—'}</span>
                      <span className="opacity-40">·</span>
                      <span>{video.aspect_ratio || '—'}</span>
                      <span className="opacity-40">·</span>
                      <span>{new Date(video.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {video.status === 'failed' && video.error_message && (
                      <p className="mt-1.5 text-xs text-red-400 line-clamp-1">{video.error_message}</p>
                    )}
                  </div>

                  {/* Action */}
                  {video.status === 'completed' && (
                    <Link
                      to={`/app/library/${video.id}`}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs font-medium hover:bg-[hsl(var(--hover))] transition-colors"
                    >
                      View
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => fetchQueue(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm disabled:opacity-40 hover:bg-[hsl(var(--hover))] transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-[hsl(var(--text-secondary))] font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => fetchQueue(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm disabled:opacity-40 hover:bg-[hsl(var(--hover))] transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default QueuePage;
