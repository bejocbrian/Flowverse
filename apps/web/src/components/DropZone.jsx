
import React, { useCallback, useState } from 'react';
import { Upload, X } from 'lucide-react';

const DropZone = ({ onFileSelect, accept = 'image/*', maxSize = 10485760 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError('');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      if (file.size > maxSize) {
        setError(`File size must be less than ${maxSize / 1048576}MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
        onFileSelect(file);
      };
      reader.readAsDataURL(file);
    }
  }, [maxSize, onFileSelect]);

  const handleFileInput = (e) => {
    setError('');
    const file = e.target.files?.[0];
    
    if (file) {
      if (file.size > maxSize) {
        setError(`File size must be less than ${maxSize / 1048576}MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
        onFileSelect(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    onFileSelect(null);
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-xl"
          />
          <button
            onClick={clearPreview}
            className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-all"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/5'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--accent-primary))]/50'
          }`}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--text-secondary))]" />
            <p className="text-[hsl(var(--text-primary))] font-medium mb-1">
              Drop image here or click to upload
            </p>
            <p className="text-sm text-[hsl(var(--text-secondary))]">
              PNG, JPG, WebP up to {maxSize / 1048576}MB
            </p>
          </label>
        </div>
      )}
      
      {error && (
        <p className="text-sm text-[hsl(var(--error))] mt-2">{error}</p>
      )}
    </div>
  );
};

export default DropZone;
