
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Sparkles, Share2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import VideoPlayer from '@/components/VideoPlayer.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';

const PublicVideoPage = () => {
  const { shareToken } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSharedVideo();
  }, [shareToken]);

  const fetchSharedVideo = async () => {
    try {
      const res = await apiServerClient.fetch(`/videos/public/${shareToken}`);
      if (!res.ok) throw new Error('Video not found or link expired');
      const data = await res.json();
      setVideo({
        ...data,
        video_url: data.video_url || 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast('Link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--canvas))] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-[hsl(var(--canvas))] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-16 h-16 text-[hsl(var(--text-secondary))] mb-6" />
        <h1 className="text-3xl font-bold mb-4">Video Unavailable</h1>
        <p className="text-[hsl(var(--text-secondary))] mb-8">{error}</p>
        <Link to="/">
          <Button>Go to VideoAI</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Shared Video - VideoAI</title>
      </Helmet>
      <div className="min-h-screen bg-[hsl(var(--canvas))] flex flex-col">
        {/* Simple Header */}
        <header className="h-16 border-b border-[hsl(var(--border))] flex items-center justify-between px-6 bg-[hsl(var(--surface))]">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[hsl(var(--accent-primary))]" />
            <span className="font-bold text-lg">VideoAI</span>
          </Link>
          <Link to="/signup">
            <Button size="sm">Create your own</Button>
          </Link>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 flex flex-col justify-center">
          <div className="glass-surface rounded-2xl overflow-hidden shadow-glass-lg mb-8">
            <VideoPlayer src={video.video_url} className="w-full aspect-video rounded-none" />
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">Prompt</h1>
              <p className="text-[hsl(var(--text-secondary))] leading-relaxed bg-[hsl(var(--surface))] p-4 rounded-xl border border-[hsl(var(--border))]">
                {video.prompt}
              </p>
              <div className="flex items-center gap-4 mt-4 text-sm text-[hsl(var(--text-secondary))]">
                <span>Created {new Date(video.created).toLocaleDateString()}</span>
                <span>•</span>
                <span className="font-mono">{video.duration}s</span>
                <span>•</span>
                <span className="font-mono">{video.aspect_ratio}</span>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <Button onClick={copyLink} size="lg" className="w-full md:w-auto text-base h-12 px-8">
                <Share2 className="w-5 h-5 mr-2" />
                Share Link
              </Button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PublicVideoPage;
