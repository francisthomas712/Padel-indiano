import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PlayerWithStats, Round, FinalsMatch, TournamentState } from '../types';

export const exportToPDF = async (elementId: string, filename: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const imgWidth = 210; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  pdf.save(filename);
};

export const generateTournamentReport = (
  leaderboard: PlayerWithStats[],
  rounds: Round[],
  finalsMatch: FinalsMatch | null
): string => {
  let report = '=== PADEL INDIANO TOURNAMENT REPORT ===\n\n';

  report += 'FINAL STANDINGS\n';
  report += '─'.repeat(50) + '\n';
  leaderboard.forEach((player, idx) => {
    report += `${idx + 1}. ${player.name}\n`;
    report += `   PPG: ${player.ppg} | Total: ${player.points} pts | Record: ${player.wins}W-${player.losses}L (${player.winRate}%)\n`;
    report += `   Matches: ${player.matchesPlayed} | Sit-outs: ${player.sitOutCount}\n\n`;
  });

  if (finalsMatch && finalsMatch.completed) {
    report += '\nFINALS RESULT\n';
    report += '─'.repeat(50) + '\n';
    const winner = finalsMatch.winner === 1 ? finalsMatch.pair1 : finalsMatch.pair2;
    report += `🏆 CHAMPIONS: ${winner.name}\n`;
    report += `Score: ${finalsMatch.score1} - ${finalsMatch.score2}\n\n`;
  }

  report += `\nTOTAL ROUNDS PLAYED: ${rounds.length}\n`;
  report += `TOTAL MATCHES: ${rounds.reduce((sum, r) => sum + r.matches.length, 0)}\n`;

  return report;
};

export const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToJSON = (state: TournamentState): void => {
  const json = JSON.stringify(state, null, 2);
  downloadTextFile(json, `padel-tournament-${Date.now()}.json`);
};

export const shareResults = async (leaderboard: PlayerWithStats[]): Promise<void> => {
  if (!navigator.share) {
    throw new Error('Web Share API not supported');
  }

  const text = leaderboard
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.name} - ${p.ppg} PPG`)
    .join('\n');

  await navigator.share({
    title: 'Padel Indiano Results',
    text: `🏆 Tournament Results:\n\n${text}\n\nPowered by Padel Indiano`
  });
};
