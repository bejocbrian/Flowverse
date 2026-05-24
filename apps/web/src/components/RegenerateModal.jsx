
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import apiServerClient from '@/lib/apiServerClient.js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const RegenerateModal = ({ videoId, isOpen, onClose, defaultSettings }) => {
  const [loading, setLoading] = useState(false);
  const [sameSettings, setSameSettings] = useState(true);
  const [varyAspectRatio, setVaryAspectRatio] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(defaultSettings?.aspect_ratio || '16:9');
  const [varyDuration, setVaryDuration] = useState(false);
  const [duration, setDuration] = useState(defaultSettings?.duration?.toString() || '5');
  const [varyQuality, setVaryQuality] = useState(false);
  const [quality, setQuality] = useState(defaultSettings?.quality || 'Standard');
  const [variationCount, setVariationCount] = useState(1);

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const response = await apiServerClient.fetch(`/videos/${videoId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sameSettings,
          varyAspectRatio: !sameSettings && varyAspectRatio ? aspectRatio : null,
          varyDuration: !sameSettings && varyDuration ? parseInt(duration) : null,
          varyQuality: !sameSettings && varyQuality ? quality : null,
          variationCount: parseInt(variationCount)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate video');
      }

      toast('Regeneration started successfully!');
      onClose();
    } catch (error) {
      console.error(error);
      toast(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] border-[hsl(var(--border))]">
        <DialogHeader>
          <DialogTitle>Regenerate with variations</DialogTitle>
          <DialogDescription className="text-[hsl(var(--text-secondary))]">
            Create new variations based on the original prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="same" checked={sameSettings} onCheckedChange={setSameSettings} />
            <Label htmlFor="same">Use identical settings</Label>
          </div>

          {!sameSettings && (
            <div className="space-y-4 pl-6 border-l border-[hsl(var(--border))]">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="vary-ar" checked={varyAspectRatio} onCheckedChange={setVaryAspectRatio} />
                  <Label htmlFor="vary-ar">Change aspect ratio</Label>
                </div>
                {varyAspectRatio && (
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="w-full bg-[hsl(var(--elevated))]">
                      <SelectValue placeholder="Select aspect ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="9:16">9:16</SelectItem>
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="4:3">4:3</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="vary-dur" checked={varyDuration} onCheckedChange={setVaryDuration} />
                  <Label htmlFor="vary-dur">Change duration</Label>
                </div>
                {varyDuration && (
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="w-full bg-[hsl(var(--elevated))]">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5s</SelectItem>
                      <SelectItem value="10">10s</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="vary-qual" checked={varyQuality} onCheckedChange={setVaryQuality} />
                  <Label htmlFor="vary-qual">Change quality</Label>
                </div>
                {varyQuality && (
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="w-full bg-[hsl(var(--elevated))]">
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fast">Fast</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="count">Number of variations to generate</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="5"
              value={variationCount}
              onChange={(e) => setVariationCount(e.target.value)}
              className="bg-[hsl(var(--elevated))] text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRegenerate} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateModal;
