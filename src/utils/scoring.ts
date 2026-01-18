export const getPointDisplay = (score1: number, score2: number): { p1: string; p2: string } => {
  const pointMap: { [key: number]: string } = { 0: '0', 1: '15', 2: '30', 3: '40' };

  // If both haven't reached 40 yet
  if (score1 <= 3 && score2 <= 3) {
    return { p1: pointMap[score1] || '40', p2: pointMap[score2] || '40' };
  }

  // Someone has gone beyond 40
  return { p1: score1 >= 4 ? 'W' : '40', p2: score2 >= 4 ? 'W' : '40' };
};

export const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const getMatchDuration = (startTime?: number, endTime?: number): string => {
  if (!startTime) return '--:--';
  const end = endTime || Date.now();
  return formatTime(end - startTime);
};
