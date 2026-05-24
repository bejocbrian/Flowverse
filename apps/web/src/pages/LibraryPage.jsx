
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Play, Search, Grid3x3, LayoutGrid, Download, Share2, Trash2, Heart } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';

const LibraryPage = () => {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchVideos();
  }, [sortBy, filterType]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      let filter = `user_id = "${currentUser.id}"`;
      
      if (filterType !== 'all') {
        filter += ` && status = "${filterType}"`;
      }

      const sortField = sortBy === 'newest' ? '-created' : sortBy === 'oldest' ? 'created' : '-duration';

      const records = await pb.collection('videos').getFullList({
        filter,
        sort: sortField,
        $autoCancel: false
      });

      setVideos(records);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      toast('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this video?')) return;

    try {
      await pb.collection('videos').delete(id, { $autoCancel: false });
      setVideos(videos.filter(v => v.id !== id));
      toast('Video deleted');
    } catch (error) {
      toast('Failed to delete video');
    }
  };

  const filteredVideos = videos.filter(video =>
    video.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>Library - AI Video Studio</title>
        <meta name="description" content="Browse your generated videos" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--canvas))] p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Your Videos</h1>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-secondary))]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search videos..."
                  className="pl-10 w-64 bg-[hsl(var(--surface))] text-white"
                />
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 bg-[hsl(var(--surface))] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 glass-surface rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-all ${
                    viewMode === 'grid'
                      ? 'bg-[hsl(var(--accent-primary))] text-white'
                      : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                  }`}
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('masonry')}
                  className={`p-2 rounded transition-all ${
                    viewMode === 'masonry'
                      ? 'bg-[hsl(var(--accent-primary))] text-white'
                      : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-8">
            {['all', 'completed', 'generating', 'queued', 'failed'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterType === type
                    ? 'bg-[hsl(var(--accent-primary))] text-white'
                    : 'bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Videos Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-surface rounded-xl overflow-hidden">
                  <div className="aspect-video bg-[hsl(var(--surface))] animate-pulse"></div>
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-[hsl(var(--surface))] rounded animate-pulse"></div>
                    <div className="h-3 bg-[hsl(var(--surface))] rounded w-2/3 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-[hsl(var(--surface))] flex items-center justify-center mx-auto mb-6">
                <Play className="w-10 h-10 text-[hsl(var(--text-secondary))]" />
              </div>
              <h2 className="text-2xl font-bold mb-2">No videos yet</h2>
              <p className="text-[hsl(var(--text-secondary))] mb-6">
                Generate your first video to get started
              </p>
              <Link to="/app/generate">
                <Button>Create Video</Button>
              </Link>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'columns-1 md:columns-2 lg:columns-3 gap-6'}>
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className={`glass-surface rounded-xl overflow-hidden group ${viewMode === 'masonry' ? 'mb-6 break-inside-avoid' : ''}`}
                >
                  <Link to={`/app/library/${video.id}`} className="block relative">
                    <div className="aspect-video bg-[hsl(var(--surface))] flex items-center justify-center">
                      {video.status === 'completed' && video.video_url ? (
                        video.output_type === 'image' ? (
                          <img src={video.video_url} alt={video.prompt} className="w-full h-full object-cover" />
                        ) : video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt={video.prompt} className="w-full h-full object-cover" />
                        ) : (
                          <Play className="w-12 h-12 text-[hsl(var(--text-secondary))]" />
                        )
                      ) : video.status === 'generating' || video.status === 'queued' ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-[hsl(var(--accent-primary))] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-[hsl(var(--text-secondary))] capitalize">{video.status}...</span>
                        </div>
                      ) : video.status === 'failed' ? (
                        <div className="flex flex-col items-center gap-2 text-[hsl(var(--error))]">
                          <span className="material-symbols-outlined text-3xl">error</span>
                          <span className="text-xs">Failed</span>
                        </div>
                      ) : (
                        <Play className="w-12 h-12 text-[hsl(var(--text-secondary))]" />
                      )}
                      {video.status === 'completed' && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          video.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          video.status === 'generating' ? 'bg-blue-500/20 text-blue-400' :
                          video.status === 'queued' ? 'bg-yellow-500/20 text-yellow-400' :
                          video.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-white/10 text-white/50'
                        }`}>{video.status}</span>
                      </div>
                      {video.duration > 0 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-xs font-mono text-white">
                          {video.duration}s
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="p-4">
                    <h3 className="font-medium mb-1 line-clamp-1">{video.prompt.slice(0, 50)}</h3>
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))] mb-3">
                      <span className="font-mono">{new Date(video.created).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded bg-[hsl(var(--surface))]">{video.model}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-8">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8">
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => handleDelete(video.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 ml-auto">
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LibraryPage;
