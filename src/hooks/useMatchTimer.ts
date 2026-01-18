import { useState, useEffect, useRef } from 'react';

export const useMatchTimer = (startTime?: number, endTime?: number) => {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number>();

  useEffect(() => {
    if (!startTime || endTime) {
      // Match not started or already ended
      if (endTime && startTime) {
        setElapsed(endTime - startTime);
      }
      return;
    }

    // Update timer every second
    const updateTimer = () => {
      setElapsed(Date.now() - startTime);
    };

    updateTimer(); // Initial update
    intervalRef.current = window.setInterval(updateTimer, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startTime, endTime]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    elapsed,
    formattedTime: formatTime(elapsed)
  };
};
