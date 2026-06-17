import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

/**
 * RegenerateModal
 *
 * Allows users to regenerate a video with:
 * - An optional refined prompt (leave blank to reuse the original)
 * - Same or different aspect ratio / duration / quality
 * - Up to 5 variations in one shot
 */
const RegenerateModal = ({ videoId, isOpen, onClose, defaultSettings, originalPrompt }) => {
  const [loading, setLoading] = useState(false);

  // Prompt refinement — empty means "reuse original"
  const [refinedPrompt, setRefinedPrompt] = useState('');

  // Settings variation
  const [sameSettings, setSameSettings] = useState(true);
  const [varyAspectRatio, setVaryAspectRatio] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(defaultSettings?.aspect_ratio || '16:9');
  const [varyDuration, setVaryDuration] = useState(false);
  const [duration, setDuration] = useState(String(defaultSettings?.duration || '8'));
  const [varyQuality, setVaryQuality] = useState(false);
  const [quality, setQuality] = useState(defaultSettings?.quality || '720p');
  const [variationCount, setVariationCount] = useState(1);

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await apiServerClient.fetch(`/videos/${videoId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only include prompt override when the user actually wrote something
          ...(refinedPrompt.trim().length >= 3 && { prompt: refinedPrompt.trim() }),
          sameSettings,
          varyAspectRatio: !sameSettings && varyAspectRatio ? aspectRatio : null,
          varyDuration: !sameSettings && varyDuration ? parseInt(duration, 10) : null,
          varyQuality: !sameSettings && varyQuality ? quality : null,
          variationCount: Math.min(5, Math.max(1, parseInt(String(variationCount), 10) || 1)),
          idempotency_key: idempotencyKey,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed (HTTP ${response.status})`);
      }

      toast.success('Regeneration started — check your Library for results.');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to regenerate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] border-[hsl(var(--border))]">
        <DialogHeader>
          <DialogTitle>Regenerate video</DialogTitle>
          <DialogDescription className="text-[hsl(var(--text-secondary))]">
            Refine your prompt or tweak settings to generate a new version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* ── Prompt refinement ── */}
          <div className="space-y-2">
            <Label htmlFor="refined-prompt">
              Refined prompt{' '}
              <span className="font-normal text-[hsl(var(--text-secondary))]">
                (optional — blank reuses original)
              </span>
            </Label>
            {originalPrompt && (
              <p className="text-xs text-[hsl(var(--text-secondary))] bg-[hsl(var(--elevated))] rounded-lg px-3 py-2 line-clamp-2">
                Original: {originalPrompt}
              </p>
            )}
            <Input
              id="refined-prompt"
              type="text"
              placeholder="e.g. same scene but at sunset with fog…"
              value={refinedPrompt}
              onChange={(e) => setRefinedPrompt(e.target.value)}
              className="bg-[hsl(var(--elevated))] text-white placeholder:text-white/30"
            />
          </div>

          {/* ── Settings variation ── */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="same"
              checked={sameSettings}
              onCheckedChange={setSameSettings}
            />
            <Label htmlFor="same">Keep identical settings</Label>
          </div>

          {!sameSettings && (
            <div className="space-y-4 pl-6 border-l border-[hsl(var(--border))]">
              {/* Aspect ratio */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vary-ar"
                    checked={varyAspectRatio}
                    onCheckedChange={setVaryAspectRatio}
                  />
                  <Label htmlFor="vary-ar">Change aspect ratio</Label>
                </div>
                {varyAspectRatio && (
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="w-full bg-[hsl(var(--elevated))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vary-dur"
                    checked={varyDuration}
                    onCheckedChange={setVaryDuration}
                  />
                  <Label htmlFor="vary-dur">Change duration</Label>
                </div>
                {varyDuration && (
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="w-full bg-[hsl(var(--elevated))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6s</SelectItem>
                      <SelectItem value="8">8s</SelectItem>
                      <SelectItem value="10">10s</SelectItem>
                      <SelectItem value="15">15s</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vary-qual"
                    checked={varyQuality}
                    onCheckedChange={setVaryQuality}
                  />
                  <Label htmlFor="vary-qual">Change resolution</Label>
                </div>
                {varyQuality && (
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="w-full bg-[hsl(var(--elevated))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p (SD)</SelectItem>
                      <SelectItem value="720p">720p (HD)</SelectItem>
                      <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                      <SelectItem value="4k">4K (UHD)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* ── Variation count ── */}
          <div className="space-y-2">
            <Label htmlFor="count">Number of variations (1–5)</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="5"
              value={variationCount}
              onChange={(e) => setVariationCount(e.target.value)}
              className="bg-[hsl(var(--elevated))] text-white w-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleRegenerate} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateModal;
