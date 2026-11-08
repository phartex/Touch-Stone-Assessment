import { AlertTriangle, ChevronRight, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { formatTimestamp } from '../../lib/format';

interface VideoPlayerProps {
  src: string;
  title: string;
  /** Position to resume from (seconds). Ignored if it's at or near the end. */
  startAt: number;
  onTimeUpdate: (time: number) => void;
  onPause: (time: number) => void;
  onSeeked: (time: number) => void;
  onEnded: (time: number) => void;
  onNext?: () => void;
  nextTitle?: string;
}

/**
 * Wraps the native <video> element. Native controls give accessible play/pause/seek/volume/fullscreen
 * with keyboard support for free; we add resume, a replay/next overlay and error handling on top.
 */
export function VideoPlayer({ src, title, startAt, onTimeUpdate, onPause, onSeeked, onEnded, onNext, nextTitle }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resumedAt, setResumedAt] = useState<number | null>(null);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    // Resume unless the learner was essentially at the end (then start over).
    if (startAt > 1 && Number.isFinite(video.duration) && startAt < video.duration - 2) {
      video.currentTime = startAt;
      setResumedAt(startAt);
    }
  };

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setEnded(false);
    void video.play();
  };

  const startOver = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setResumedAt(null);
  };

  if (failed) {
    return (
      <div role="alert" className="flex aspect-video flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center text-white">
        <AlertTriangle className="size-8 text-amber-400" aria-hidden />
        <p className="font-medium">This video couldn't be loaded.</p>
        <p className="text-sm text-slate-300">Check your connection, or try again in a moment.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setFailed(false);
            videoRef.current?.load();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-black">
      <video
        ref={videoRef}
        key={src}
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={`Video: ${title}`}
        className="size-full"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onPause={(e) => !e.currentTarget.ended && onPause(e.currentTarget.currentTime)}
        onSeeked={(e) => onSeeked(e.currentTarget.currentTime)}
        onPlay={() => setEnded(false)}
        onEnded={(e) => {
          setEnded(true);
          onEnded(e.currentTarget.currentTime);
        }}
        onError={() => setFailed(true)}
      />

      {resumedAt !== null && !ended && (
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs text-white" role="status">
          Resumed at {formatTimestamp(resumedAt)}
          <button type="button" className="font-semibold text-brand-100 underline" onClick={startOver}>
            Start over
          </button>
        </div>
      )}

      {ended && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/85 p-6 text-center text-white">
          <p className="text-lg font-semibold">Lesson finished</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" icon={<RotateCcw className="size-4" aria-hidden />} onClick={replay}>
              Replay
            </Button>
            {onNext && (
              <Button onClick={onNext} icon={<ChevronRight className="size-4" aria-hidden />}>
                Next: {nextTitle}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
