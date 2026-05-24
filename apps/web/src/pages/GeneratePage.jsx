import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import VideoPlayer from '@/components/VideoPlayer.jsx';
import { Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import apiServerClient from '@/lib/apiServerClient.js';
import { motion } from 'framer-motion';

// Default model costs (fallback if API fails)
const DEFAULT_MODEL_COSTS = {
  'veo-3.1-fast': { '720p': 8, '1080p': 12 },
  'veo-3.1-lite': { '720p': 6, '1080p': 10 },
  'veo-3.1': { '720p': 10, '1080p': 15 },
  'veo-2': { '720p': 8, '1080p': 12 },
  'grok-3': { '720p': 8, '1080p': 12 },
};

const AI_MODELS = [
  // Veo 3.1 Fast variants
  { id: 'veo-3.1-fast', label: 'Veo 3.1 Fast HD', provider: 'Google', type: 'video', durations: [4, 6, 8], resolutions: ['720p'] },
  { id: 'veo-3.1-fast', label: 'Veo 3.1 Fast Full HD', provider: 'Google', type: 'video', durations: [4, 6, 8], resolutions: ['1080p'] },
  // Veo 3.1 Lite variants
  { id: 'veo-3.1-lite', label: 'Veo 3.1 Lite HD', provider: 'Google', type: 'video', durations: [4, 6, 8], resolutions: ['720p'] },
  { id: 'veo-3.1-lite', label: 'Veo 3.1 Lite Full HD', provider: 'Google', type: 'video', durations: [4, 6, 8], resolutions: ['1080p'] },
  // Grok 3
  { id: 'grok-3', label: 'Grok 3', provider: 'xAI', type: 'video', durations: [4, 6, 8], resolutions: ['720p'] },
];

const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', icon: 'smartphone' },
  { id: '16:9', label: '16:9', icon: 'rectangle' },
];

const GeneratePage = () => {
  const { currentUser, refreshUser } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [mode, setMode] = useState('Frames'); // Frames or Ingredients

  // Feature flags from admin settings
  const [featureFlags, setFeatureFlags] = useState({
    show_duration_selector: false,
    default_duration: 8,
    available_durations: [4, 6, 8],
    allow_multi_generation: false,
    max_generations_per_request: 1,
  });

  // Credit costs from API
  const [modelCreditCosts, setModelCreditCosts] = useState(DEFAULT_MODEL_COSTS);

  // Model selection
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0]);
  const [selectedResolution, setSelectedResolution] = useState('720p');
  const [selectedDuration, setSelectedDuration] = useState(8); // Default to 8 seconds
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null); // { type: 'video', url: string }
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const pollingRef = useRef(null);
  const progressRef = useRef(null);

  // Compute credit cost dynamically from API data
  const currentCost = modelCreditCosts[selectedModel.id]?.[selectedResolution] || 40;

  // Fetch public settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiServerClient.fetch('/settings/public');
        if (res.ok) {
          const data = await res.json();
          
          // Parse feature flags
          let flags = data.feature_flags;
          if (typeof flags === 'string') {
            flags = JSON.parse(flags);
          }
          
          if (flags) {
            setFeatureFlags(flags);
            // Set default duration from admin settings
            setSelectedDuration(flags.default_duration || 8);
          }

          // Set default aspect ratio from settings
          if (data.default_aspect_ratio) {
            const ratio = typeof data.default_aspect_ratio === 'string' 
              ? data.default_aspect_ratio 
              : data.default_aspect_ratio.text;
            if (ratio) setAspectRatio(ratio);
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    
    fetchSettings();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  /**
   * Poll the video status endpoint until completed or failed
   */
  const startPolling = useCallback((videoId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiServerClient.fetch(`/videos/${videoId}/status`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === 'completed' && data.video_url) {
          clearInterval(pollingRef.current);
          clearInterval(progressRef.current);
          pollingRef.current = null;
          progressRef.current = null;

          setProgress(100);
          setGeneratedResult({ type: 'video', url: data.video_url });
          setLoading(false);
          refreshUser();
          toast.success('Video generation complete!');
        } else if (data.status === 'failed') {
          clearInterval(pollingRef.current);
          clearInterval(progressRef.current);
          pollingRef.current = null;
          progressRef.current = null;

          setLoading(false);
          setProgress(0);
          toast.error(data.error_message || 'Generation failed');
          refreshUser();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);
  }, [refreshUser]);

  const handleGenerate = async () => {
    if (prompt.trim().length < 3) {
      toast('Please enter a prompt');
      return;
    }

    if (currentUser.credits_balance < currentCost) {
      toast('Insufficient credits');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('Submitting...');
    setGeneratedResult(null);

    try {
      const response = await apiServerClient.fetch('/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio,
          duration: selectedDuration,
          quality: selectedResolution,
          provider: selectedModel.provider,
          model: selectedModel.id,
          output_type: 'video',
          mode_image: mode === 'Frames' ? 'frame' : 'ingredient',
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let errMsg = errData.error || 'Generation failed';
        if (errData.details) {
          const firstErrorKey = Object.keys(errData.details)[0];
          if (firstErrorKey) {
            errMsg = `${firstErrorKey}: ${errData.details[firstErrorKey].message}`;
          }
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const videoId = data.video?.id;
      setStatus('Synthesizing frames...');

      // Start progress animation
      progressRef.current = setInterval(() => {
        setProgress(prev => prev >= 90 ? 90 : prev + 1);
      }, 1000);

      // Start polling for completion
      startPolling(videoId);

    } catch (error) {
      setLoading(false);
      setProgress(0);
      toast.error(error.message);
    }
  };

  const handleDelete = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setGeneratedResult(null);
    setPrompt('');
    toast('Workspace cleared');
  };

  // Get available durations for the current model, filtered by admin settings
  const availableDurations = featureFlags.show_duration_selector 
    ? (featureFlags.available_durations || [4, 6, 8]).filter(d => 
        selectedModel.durations?.includes(d)
      )
    : [];

  return (
    <>
      <Helmet>
        <title>Workspace - Aether Video</title>
      </Helmet>

      <div className="flex-grow relative bg-black flex flex-col items-center justify-center p-gutter overflow-hidden h-full min-h-[calc(100vh-64px)]">

        {/* Center Content Area */}
        <div
          className={`relative z-10 w-full max-w-5xl flex flex-col items-center justify-center -mt-32 transition-all duration-300 ${isDragging ? 'scale-105 opacity-50' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            toast('Media assets received');
          }}
        >
          {!loading && !generatedResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 flex flex-col items-center"
            >
              {/* Pixel Art Icon Placeholder (Plant/Flower) */}
              <div className="text-white opacity-80 mb-4 scale-150">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2V6M12 2C10.5 2 9 3.5 9 5C9 6.5 10.5 8 12 8M12 2C13.5 2 15 3.5 15 5C15 6.5 13.5 8 12 8M12 8V16M12 16L9 19M12 16L15 19M12 8C10 8 8 10 8 12C8 14 10 16 12 16M12 8C14 8 16 10 16 12C16 14 14 16 12 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="7" y="11" width="2" height="2" fill="currentColor" />
                  <rect x="15" y="11" width="2" height="2" fill="currentColor" />
                  <rect x="11" y="7" width="2" height="2" fill="currentColor" />
                  <rect x="11" y="15" width="2" height="2" fill="currentColor" />
                </svg>
              </div>
              <h1 className="font-headline-md text-headline-md text-on-surface-variant font-medium opacity-60">
                Start creating or drop media
              </h1>
            </motion.div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="w-full max-w-2xl space-y-8 flex flex-col items-center">
              <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin" />
              <p className="font-metadata text-metadata text-primary uppercase tracking-[0.2em]">{status} {progress}%</p>
            </div>
          )}

          {/* Generated Result Display */}
          {generatedResult && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
              <VideoPlayer src={generatedResult.url} className="w-full aspect-video" />

              <button
                onClick={handleDelete}
                className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 text-white"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>

        {/* Floating Advanced UI */}
        <div className="absolute bottom-12 w-full max-w-4xl px-gutter z-50 flex flex-col items-center gap-4">

          {/* Settings Panel */}
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-[380px] self-end bg-[#1a1b1e]/95 backdrop-blur-3xl rounded-3xl p-5 border border-white/5 shadow-2xl flex flex-col gap-5 mr-8 mb-[-10px]"
            >
              {/* Mode Toggle: Frames/Ingredients */}
              <div className="flex gap-2">
                {['Frames', 'Ingredients (Experimental)'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${mode === m ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-transparent text-white/40 hover:text-white'}`}
                  >
                    <span className="material-symbols-outlined text-lg">{m === 'Frames' ? 'filter_center_focus' : 'category'}</span>
                    {m}
                  </button>
                ))}
              </div>

              {/* Aspect Ratio */}
              <div className="flex flex-col gap-3">
                <div className="flex bg-black/40 p-1 rounded-2xl">
                  {ASPECT_RATIOS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setAspectRatio(r.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${aspectRatio === r.id
                        ? 'bg-white text-black'
                        : 'text-white/40 hover:text-white'
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {r.icon}
                      </span>
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selector - Only shown if admin enabled it */}
              {featureFlags.show_duration_selector && availableDurations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-white/40 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Duration
                  </label>
                  <div className="flex bg-black/40 p-1 rounded-2xl">
                    {availableDurations.map(dur => (
                      <button
                        key={dur}
                        onClick={() => setSelectedDuration(dur)}
                        className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition-all ${selectedDuration === dur
                          ? 'bg-white text-black'
                          : 'text-white/40 hover:text-white'
                          }`}
                      >
                        {dur}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Selector & Credits */}
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  {AI_MODELS.map(m => (
                    <button
                      key={m.id + m.label}
                      onClick={() => {
                        setSelectedModel(m);
                        if (m.resolutions) setSelectedResolution(m.resolutions[0]);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedModel.id === m.id && selectedModel.label === m.label ? 'bg-white/15 border border-white/20 text-white' : 'bg-black/20 border border-transparent text-white/50 hover:text-white hover:bg-black/40'}`}
                    >
                      <span>{m.label}</span>
                      <span className="text-[10px] opacity-60">{m.provider}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-[11px] font-medium text-white/40">
                  Generating will use <span className="text-white/80 underline decoration-white/20 underline-offset-4 cursor-help">{currentCost} credits</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Main Input Bar */}
          <div className="w-full bg-[#1a1b1e]/80 backdrop-blur-3xl rounded-[40px] p-4 border border-white/10 shadow-2xl flex items-center gap-4">

            {/* Prompt Input */}
            <div className="flex-1 relative flex flex-col justify-center">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the motion you want to create..."
                className="w-full bg-transparent border-none outline-none text-lg font-medium text-white placeholder:text-white/20 px-2"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${showSettings ? 'bg-white/20 border-white/40' : 'bg-black/40 border-white/10 hover:bg-black/60'}`}
              >
                <span className="text-[10px] font-bold text-white/60">{aspectRatio}</span>
                <span className="material-symbols-outlined text-xs text-white/40">{aspectRatio === '16:9' ? 'rectangle' : 'smartphone'}</span>
                <span className="text-[10px] font-bold text-white/60">{selectedResolution}</span>
                {/* Show duration in the button if selector is hidden (so user knows what they'll get) */}
                {!featureFlags.show_duration_selector && (
                  <span className="text-[10px] font-bold text-white/60 ml-1">{selectedDuration}s</span>
                )}
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-glow-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-2xl" style={{ fontWeight: 600 }}>arrow_forward</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </>
  );
};

export default GeneratePage;
