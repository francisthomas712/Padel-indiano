export const getPointDisplay = (score1: number, score2: number): { p1: string; p2: string } => {
  // Simple numeric scoring - just return the scores as strings
  return { p1: score1.toString(), p2: score2.toString() };
};

export const checkMatchWinner = (score1: number, score2: number, pointsToWin: number): number | null => {
  // First to pointsToWin wins
  if (score1 >= pointsToWin && score1 > score2) return 1;
  if (score2 >= pointsToWin && score2 > score1) return 2;
  return null;
};

export const getNextServer = (
  currentServer: 'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2' | undefined
): 'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2' => {
  // Service rotation: pair1-p1 → pair2-p1 → pair1-p2 → pair2-p2 → pair1-p1
  const rotation: Array<'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2'> = [
    'pair1-p1',
    'pair2-p1',
    'pair1-p2',
    'pair2-p2'
  ];

  if (!currentServer) return 'pair1-p1';

  const currentIndex = rotation.indexOf(currentServer);
  return rotation[(currentIndex + 1) % 4];
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
