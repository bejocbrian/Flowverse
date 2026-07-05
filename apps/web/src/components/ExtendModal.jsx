import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const ExtendModal = ({ videoId, isOpen, onClose, sourcePrompt }) => {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');

  const handleExtend = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast('Please enter a prompt describing the continuation');
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await apiServerClient.fetch(`/videos/${videoId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          idempotency_key: idempotencyKey,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extend video');
      }

      const data = await response.json();
      toast.success('Video extension started! The new video will appear in your library.');
      onClose();
      setPrompt('');
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        setPrompt('');
      }
    }}>
      <DialogContent className="sm:max-w-lg bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] border-[hsl(var(--border))]">
        <DialogHeader>
          <DialogTitle>Extend Video</DialogTitle>
          <DialogDescription className="text-[hsl(var(--text-secondary))]">
            Continue the video with a new scene. The model will use the last frame of your current video as a starting point.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="source-prompt">Original prompt</Label>
            <div className="p-3 rounded-lg bg-[hsl(var(--elevated))] text-sm text-[hsl(var(--text-secondary))]">
              {sourcePrompt || 'No prompt available'}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extend-prompt">What happens next? *</Label>
            <Textarea
              id="extend-prompt"
              placeholder="Describe what should happen in the continuation (e.g., 'The camera pans left to reveal a sunset over the mountains')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="bg-[hsl(var(--elevated))] text-white resize-none"
            />
            <p className="text-xs text-[hsl(var(--text-secondary))]">
              Be specific about actions, movements, or changes you want to see
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleExtend} disabled={loading || !prompt.trim()}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Extend Video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExtendModal;