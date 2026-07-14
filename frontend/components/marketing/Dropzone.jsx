"use client";
import React, { useRef, useState } from 'react';
import { Upload, File as FileIcon, X, Check } from 'lucide-react';
import { toast } from 'sonner';

const ACCEPTED = ['.csv', '.xlsx', '.xls'];
const MAX_MB = 10;

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function validate(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ACCEPTED.includes(ext)) return `Unsupported format · ${ACCEPTED.join(', ')} only`;
  if (file.size > MAX_MB * 1024 * 1024) return `File too large · max ${MAX_MB} MB`;
  return null;
}

export default function Dropzone() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    const err = validate(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(f);
    setAnalyzed(false);
    // Simulate auto-mapping columns in a marketing demo.
    setTimeout(() => {
      setAnalyzed(true);
      toast.success(`Mapped ${f.name.split('.')[0]} · 5 columns detected`);
    }, 900);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const onSelect = (e) => {
    const f = e.target.files?.[0];
    handleFile(f);
    // Reset so selecting the same file twice still triggers change
    e.target.value = '';
  };

  const reset = () => {
    setFile(null);
    setAnalyzed(false);
  };

  if (file) {
    return (
      <div className="mt-4 hairline rounded-card p-5 bg-elevated" data-testid="dropzone-selected">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-btn bg-bg hairline flex items-center justify-center shrink-0">
            <FileIcon size={14} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white truncate" data-testid="dropzone-filename">
              {file.name}
            </p>
            <p className="text-[11.5px] text-muted mt-0.5 num">
              {fmtBytes(file.size)} · {analyzed ? 'mapped' : 'analysing…'}
            </p>
          </div>
          <button
            onClick={reset}
            aria-label="Remove file"
            className="p-1.5 text-muted hover:text-white transition-colors"
            data-testid="dropzone-remove"
          >
            <X size={13} />
          </button>
        </div>
        {analyzed && (
          <div className="mt-4 pt-4 hairline-t space-y-1.5" data-testid="dropzone-mapping">
            {[
              ['Column A', 'date', 'Date'],
              ['Column B', 'account', 'Account'],
              ['Column C', 'description', 'Description'],
              ['Column D', 'amount', 'Amount'],
              ['Column E', 'currency', 'Currency'],
            ].map(([col, mapped, label]) => (
              <div key={col} className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted num">{col}</span>
                <span className="text-muted">→</span>
                <span className="text-white flex-1 ml-3 text-right">{label}</span>
                <Check size={11} className="text-positive ml-2" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={`mt-4 rounded-card p-8 text-center cursor-pointer transition-colors border border-dashed ${
        dragging
          ? 'border-accent/60 bg-elevated'
          : 'border-[rgba(255,255,255,0.14)] hover:border-[rgba(255,255,255,0.24)] hover:bg-elevated'
      }`}
      data-testid="dropzone"
      aria-label="Upload actuals CSV or XLSX"
    >
      <Upload size={18} className="text-accent mx-auto" />
      <p className="mt-3 text-[13.5px] text-white">
        {dragging ? 'Release to upload' : 'Drop CSV or XLSX'}
      </p>
      <p className="mt-1 text-[11.5px] text-muted">
        or click to browse · max {MAX_MB} MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={onSelect}
        className="hidden"
        data-testid="dropzone-input"
      />
    </div>
  );
}
