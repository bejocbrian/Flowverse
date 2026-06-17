import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Check, 
  X, 
  Loader2, 
  AlertTriangle,
  Sparkles,
  Video,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * PreviewConfirmDialog - Shows preview video and allows user to confirm or cancel
 * 
 * @param {Object} props
 * @param {string} props.previewId - The preview ID
 * @param {string} props.previewUrl - URL of the preview video/image
 * @param {number} props.previewCredits - Credits spent on preview
 * @param {number} props.fullCredits - Total credits for full generation
 * @param {string} props.prompt - The generation prompt
 * @param {Function} props.onConfirm - Callback when user confirms
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {Function} props.onClose - Callback to close dialog
 */
const PreviewConfirmDialog = ({
  previewId,
  previewUrl,
  previewCredits = 5,
  fullCredits = 15,
  prompt,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const [status, setStatus] = useState('loading'); // loading, ready, confirming, confirmed, cancelled, cancelling
  const [isPlaying, setIsPlaying] = useState(true);
  const [additionalCredits] = useState(fullCredits - previewCredits);
  const videoRef = useRef(null);

  // Transition to 'ready' once a preview URL is available
  useEffect(() => {
    if (previewUrl && status === 'loading') {
      setStatus('ready');
    }
  }, [previewUrl, status]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && status !== 'confirming') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [status, onClose]);

  const handleConfirm = async () => {
    setStatus('confirming');
    try {
      await onConfirm();
      setStatus('confirmed');
      toast.success('Full generation started!');
    } catch (error) {
      toast.error(error.message || 'Failed to confirm');
      setStatus('ready');
    }
  };

  const handleCancel = async () => {
    setStatus('cancelling');
    try {
      await onCancel();
      setStatus('cancelled');
      toast.info('Preview cancelled');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel');
      setStatus('ready');
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[hsl(var(--accent-primary))]" />
              <h2 className="text-lg font-semibold">Preview Your Video</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[hsl(var(--hover))] transition-colors"
              disabled={status === 'confirming' || status === 'cancelling'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preview Video/Image */}
          <div className="relative aspect-video bg-black">
            {previewUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={previewUrl}
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                  muted
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {/* Play/Pause overlay */}
                <button
                  onClick={togglePlayback}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    {isPlaying ? (
                      <Pause className="w-8 h-8 text-white" />
                    ) : (
                      <Play className="w-8 h-8 text-white ml-1" />
                    )}
                  </div>
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--accent-primary))]" />
                  <p className="text-sm text-white/70">Generating preview...</p>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Display */}
          <div className="p-4 border-b border-[hsl(var(--border))]">
            <p className="text-sm text-[hsl(var(--text-secondary))] mb-1">Prompt</p>
            <p className="text-[hsl(var(--text-primary))]">{prompt}</p>
          </div>

          {/* Credits Info */}
          <div className="p-4 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[hsl(var(--text-secondary))]" />
                <span className="text-sm text-[hsl(var(--text-secondary))]">Credits</span>
              </div>
              <div className="text-sm">
                <span className="text-[hsl(var(--text-secondary))] line-through mr-2">
                  {fullCredits}
                </span>
                <span className="font-semibold text-[hsl(var(--accent-primary))]">
                  {additionalCredits} more
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
              <AlertTriangle className="w-3 h-3" />
              <span>Preview credits ({previewCredits}) already deducted</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 p-4">
            <button
              onClick={handleCancel}
              disabled={status === 'confirming' || status === 'cancelling'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(var(--border))] font-medium hover:bg-[hsl(var(--hover))] transition-colors disabled:opacity-50"
            >
              {status === 'cancelling' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={status === 'confirming' || status === 'cancelling'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--accent-primary))] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {status === 'confirming' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Confirm Full Generation
            </button>
          </div>

          {/* Status Messages */}
          {status === 'confirming' && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--accent-primary))]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting full generation...
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PreviewConfirmDialog;