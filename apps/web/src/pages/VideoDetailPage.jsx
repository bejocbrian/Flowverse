
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import VideoPlayer from '@/components/VideoPlayer.jsx';
import RegenerateModal from '@/components/RegenerateModal.jsx';
import { ArrowLeft, Download, Share2, Trash2, Copy, Heart, Repeat, Play } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import apiServerClient from '@/lib/apiServerClient.js';

const VideoDetailPage = () => {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);

  useEffect(() => {
    fetchVideo();
  }, [id]);

  const fetchVideo = async () => {
    setLoading(true);
    try {
      const response = await apiServerClient.fetch(`/videos/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }

      const data = await response.json();
      setVideo(data.video);
      setRelatedVideos(data.relatedVideos || []);
    } catch (error) {
      console.error('Failed to fetch video:', error);
      toast('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = () => {
    if (video?.prompt) {
      navigator.clipboard.writeText(video.prompt);
      toast('Prompt copied to clipboard');
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/videos/public/${video.share_token}`;
    navigator.clipboard.writeText(url);
    toast('Public link copied to clipboard');
  };

  const togglePublic = async (isPublic) => {
    try {
      if (isPublic) {
        const res = await apiServerClient.fetch(`/videos/${id}/share`, {
          method: 'POST',
          body: JSON.stringify({ expiresIn: null }) // never expire
        });
        const data = await res.json();
        setVideo(prev => ({ ...prev, is_public: true, share_token: data.shareToken }));
        toast('Video made public');
      } else {
        await apiServerClient.fetch(`/videos/${id}/unshare`, { method: 'POST' });
        setVideo(prev => ({ ...prev, is_public: false, share_token: null }));
        toast('Video is now private');
      }
    } catch (err) {
      toast('Failed to update visibility');
    }
  };

  const toggleFavorite = async () => {
    try {
      if (video.is_favorite) {
        await apiServerClient.fetch(`/videos/${id}/favorite`, { method: 'DELETE' });
        setVideo(prev => ({ ...prev, is_favorite: false }));
        toast('Removed from favorites');
      } else {
        await apiServerClient.fetch(`/videos/${id}/favorite`, { method: 'POST' });
        setVideo(prev => ({ ...prev, is_favorite: true }));
        toast('Added to favorites');
      }
    } catch (err) {
      toast('Failed to update favorites');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--canvas))] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[hsl(var(--text-secondary))]">Loading video...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[hsl(var(--canvas))] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Video not found</h2>
          <Link to="/app/library">
            <Button>Back to Library</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${video.prompt.slice(0, 50)} - AI Video Studio`}</title>
        <meta name="description" content={video.prompt} />
      </Helmet>

      <div className="min-h-[calc(100vh-64px)] bg-[hsl(var(--canvas))] p-8">
        <div className="max-w-7xl mx-auto">
          <Link
            to="/app/library"
            className="inline-flex items-center gap-2 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Video Player */}
            <div className="lg:col-span-2 space-y-6">
              <VideoPlayer
                src={video.video_url}
                className="aspect-video w-full shadow-glass-lg"
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Download HD
                </Button>
                <Button variant="outline" onClick={() => setIsRegenerateModalOpen(true)}>
                  <Repeat className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
                <Button 
                  variant="outline" 
                  onClick={toggleFavorite}
                  className={video.is_favorite ? 'text-rose-500 border-rose-500/50 bg-rose-500/10' : ''}
                >
                  <Heart className={`w-4 h-4 mr-2 ${video.is_favorite ? 'fill-current' : ''}`} />
                  {video.is_favorite ? 'Favorited' : 'Favorite'}
                </Button>
                <Button variant="outline" className="text-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/10 border-[hsl(var(--error))]/20">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>

              {/* Related Videos */}
              {relatedVideos.length > 0 && (
                <div className="pt-8 border-t border-[hsl(var(--border))]">
                  <h2 className="text-xl font-bold mb-6">Regenerated Variations</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {relatedVideos.map((related) => (
                      <Link
                        key={related.id}
                        to={`/app/library/${related.id}`}
                        className="glass-surface rounded-xl overflow-hidden group hover:border-[hsl(var(--accent-primary))]/50 transition-colors"
                      >
                        <div className="aspect-video bg-[hsl(var(--surface))] flex items-center justify-center relative">
                          {related.video_url && related.output_type === 'image' ? (
                            <img src={related.video_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="Variation" />
                          ) : related.thumbnail_url ? (
                            <img src={related.thumbnail_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="Variation" />
                          ) : (
                            <Play className="w-8 h-8 text-[hsl(var(--text-secondary))]" />
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-medium text-white px-2 py-1 rounded bg-[hsl(var(--accent-primary))]">View</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata Panel */}
            <div className="space-y-6">
              <div className="glass-surface rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-[hsl(var(--text-secondary))] mb-3">Visibility</h3>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--elevated))] border border-[hsl(var(--border))]">
                    <div>
                      <span className="text-sm font-medium block">Public Link</span>
                      <span className="text-xs text-[hsl(var(--text-secondary))]">Anyone with link can view</span>
                    </div>
                    <Switch checked={video.is_public} onCheckedChange={togglePublic} />
                  </div>
                  {video.is_public && video.share_token && (
                    <div className="mt-3 flex gap-2">
                      <div className="flex-1 truncate bg-[hsl(var(--surface))] text-xs font-mono p-2 rounded border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]">
                        {window.location.origin}/videos/public/{video.share_token}
                      </div>
                      <Button variant="outline" size="icon" onClick={copyShareLink}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-[hsl(var(--border))]">
                  <h3 className="text-sm font-medium text-[hsl(var(--text-secondary))] mb-3">Prompt</h3>
                  <div className="glass-elevated rounded-lg p-4 relative group">
                    <p className="text-sm leading-relaxed mb-8">{video.prompt}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={copyPrompt}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t border-[hsl(var(--border))]">
                  <h3 className="text-sm font-medium text-[hsl(var(--text-secondary))] mb-3">Settings Used</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Aspect Ratio</span>
                      <span className="font-mono bg-[hsl(var(--surface))] px-2 py-0.5 rounded">{video.aspect_ratio}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Duration</span>
                      <span className="font-mono bg-[hsl(var(--surface))] px-2 py-0.5 rounded">{video.duration}s</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Quality</span>
                      <span className="font-mono bg-[hsl(var(--surface))] px-2 py-0.5 rounded">{video.quality}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--text-secondary))]">Provider Engine</span>
                      <span className="font-mono bg-[hsl(var(--surface))] px-2 py-0.5 rounded">{video.provider} {video.model}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[hsl(var(--border))]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--text-secondary))]">Created</span>
                    <span className="font-mono">{new Date(video.created).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-3">
                    <span className="text-[hsl(var(--text-secondary))]">Credit Cost</span>
                    <span className="font-mono text-[hsl(var(--accent-primary))] font-bold">{video.credit_cost} credits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RegenerateModal 
        videoId={id}
        isOpen={isRegenerateModalOpen}
        onClose={() => setIsRegenerateModalOpen(false)}
        defaultSettings={video}
      />
    </>
  );
};

export default VideoDetailPage;
