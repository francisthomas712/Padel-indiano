export const getPointDisplay = (score1: number, score2: number): { p1: string; p2: string } => {
  // Simple numeric scoring - just return the scores as strings
  return { p1: score1.toString(), p2: score2.toString() };
};

export type ServerPosition = 'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2';

const SERVER_ROTATION: ServerPosition[] = [
  'pair1-p1',
  'pair2-p1',
  'pair1-p2',
  'pair2-p2'
];

export const getNextServer = (currentServer: ServerPosition | undefined): ServerPosition => {
  // Service rotation: pair1-p1 → pair2-p1 → pair1-p2 → pair2-p2 → pair1-p1
  if (!currentServer) return SERVER_ROTATION[0];

  const currentIndex = SERVER_ROTATION.indexOf(currentServer);
  return SERVER_ROTATION[(currentIndex + 1) % 4];
};

export const getPreviousServer = (currentServer: ServerPosition | undefined): ServerPosition => {
  // Inverse rotation, used when correcting a mis-entered point (-1)
  if (!currentServer) return SERVER_ROTATION[0];

  const currentIndex = SERVER_ROTATION.indexOf(currentServer);
  return SERVER_ROTATION[(currentIndex + SERVER_ROTATION.length - 1) % 4];
};

/**
 * Resolve a server position to which pair and which player slot serves.
 * Used to display "Serve: <name>" on scoreboards.
 */
export const getServerInfo = (server: ServerPosition | undefined): { pair: 1 | 2; slot: 0 | 1 } => {
  switch (server ?? 'pair1-p1') {
    case 'pair2-p1': return { pair: 2, slot: 0 };
    case 'pair1-p2': return { pair: 1, slot: 1 };
    case 'pair2-p2': return { pair: 2, slot: 1 };
    default: return { pair: 1, slot: 0 };
  }
};

export interface WinCheckOptions {
  /** Winner must lead by at least 2 points once pointsToWin is reached */
  winByTwo?: boolean;
  /** With winByTwo, a tied score at/above pointsToWin is broken by the next point (golden point) */
  goldenPoint?: boolean;
}

export const checkMatchWinner = (
  score1: number,
  score2: number,
  pointsToWin: number,
  options?: WinCheckOptions
): number | null => {
  if (options?.winByTwo) {
    const leader = score1 > score2 ? 1 : score2 > score1 ? 2 : null;
    if (leader === null) return null;
    const maxScore = Math.max(score1, score2);
    if (maxScore < pointsToWin) return null;
    // Clear win by 2...
    if (maxScore - Math.min(score1, score2) >= 2) return leader;
    // ...or golden point: both teams are at/above target and tied was just broken
    if (options.goldenPoint && score1 >= pointsToWin && score2 >= pointsToWin) return leader;
    return null;
  }

  // First to pointsToWin wins
  if (score1 >= pointsToWin && score1 > score2) return 1;
  if (score2 >= pointsToWin && score2 > score1) return 2;
  return null;
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
