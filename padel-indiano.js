import React, { useState, useEffect } from ‘react’;
import { Users, Plus, Trash2, Trophy, Play, RotateCcw, UserMinus, PlusCircle, ToggleLeft, ToggleRight } from ‘lucide-react’;

const PadelIndiano = () => {
const [players, setPlayers] = useState([]);
const [newPlayerName, setNewPlayerName] = useState(’’);
const [rounds, setRounds] = useState([]);
const [tournamentStarted, setTournamentStarted] = useState(false);
const [leaderboardMode, setLeaderboardMode] = useState(‘ppg’); // ‘ppg’ or ‘total’
const [partnershipHistory, setPartnershipHistory] = useState({}); // Track who played with whom
const [oppositionHistory, setOppositionHistory] = useState({}); // Track who played against whom
const [finalsMode, setFinalsMode] = useState(false);
const [finalsMatch, setFinalsMatch] = useState(null);
const [activeTab, setActiveTab] = useState(‘tournament’); // ‘tournament’ or ‘rules’
const [editingMatch, setEditingMatch] = useState(null); // {roundId, matchId} or null

// Initialize partnership and opposition history for a player
const initializePlayerHistory = (playerId) => {
if (!partnershipHistory[playerId]) {
setPartnershipHistory(prev => ({ …prev, [playerId]: {} }));
}
if (!oppositionHistory[playerId]) {
setOppositionHistory(prev => ({ …prev, [playerId]: {} }));
}
};

// Get player skill rating (PPG with minimum games consideration)
const getPlayerSkill = (player) => {
if (player.matchesPlayed === 0) return 0;
return player.points / player.matchesPlayed;
};

// Generate a single round with dynamic skill-based pairing
const generateNextRound = () => {
const activePlayers = players.filter(p => p.active);

```
if (activePlayers.length < 4) {
  alert('Need at least 4 active players to generate a round');
  return;
}

// Sort players by skill level (PPG)
const sortedPlayers = [...activePlayers].sort((a, b) => {
  const skillA = getPlayerSkill(a);
  const skillB = getPlayerSkill(b);
  if (Math.abs(skillA - skillB) < 0.01) {
    // If skills very similar, randomize to add variety
    return Math.random() - 0.5;
  }
  return skillB - skillA; // Higher skill first
});

// Create pairs with skill balancing and partnership variety
const pairs = [];
const usedPlayers = new Set();
const playersToMatch = [...sortedPlayers];

// Handle odd number of players - one sits out
let sittingOut = null;
if (playersToMatch.length % 4 === 1 || playersToMatch.length % 4 === 3) {
  // Find player who has sat out least or hasn't sat out yet
  const sitOutCounts = activePlayers.map(p => ({
    player: p,
    sitOutCount: p.sitOutCount || 0,
    matchesPlayed: p.matchesPlayed
  })).sort((a, b) => {
    // Prioritize: fewer sit-outs, then more matches played
    if (a.sitOutCount !== b.sitOutCount) return a.sitOutCount - b.sitOutCount;
    return b.matchesPlayed - a.matchesPlayed;
  });
  
  sittingOut = sitOutCounts[0].player;
  playersToMatch.splice(playersToMatch.findIndex(p => p.id === sittingOut.id), 1);
}

// If still odd after removing one, remove one more
if (playersToMatch.length % 4 === 2) {
  const sitOutCounts = playersToMatch.map(p => ({
    player: p,
    sitOutCount: p.sitOutCount || 0,
    matchesPlayed: p.matchesPlayed
  })).sort((a, b) => {
    if (a.sitOutCount !== b.sitOutCount) return a.sitOutCount - b.sitOutCount;
    return b.matchesPlayed - a.matchesPlayed;
  });
  
  const secondSitOut = sitOutCounts[0].player;
  playersToMatch.splice(playersToMatch.findIndex(p => p.id === secondSitOut.id), 1);
  
  if (!sittingOut) sittingOut = secondSitOut;
  else sittingOut = { id: 'multi', name: `${sittingOut.name}, ${secondSitOut.name}`, players: [sittingOut, secondSitOut] };
}

// Create pairs trying to maximize variety and balance skill
while (playersToMatch.length >= 2) {
  let bestPair = null;
  let bestScore = -Infinity;

  for (let i = 0; i < playersToMatch.length; i++) {
    if (usedPlayers.has(playersToMatch[i].id)) continue;
    
    for (let j = i + 1; j < playersToMatch.length; j++) {
      if (usedPlayers.has(playersToMatch[j].id)) continue;
      
      const p1 = playersToMatch[i];
      const p2 = playersToMatch[j];
      
      // Calculate pairing score
      const partnerCount = (partnershipHistory[p1.id]?.[p2.id] || 0);
      const skillDiff = Math.abs(getPlayerSkill(p1) - getPlayerSkill(p2));
      
      // Prefer: haven't played together (high priority), similar skill (medium priority)
      const score = -partnerCount * 100 - skillDiff * 10;
      
      if (score > bestScore) {
        bestScore = score;
        bestPair = [p1, p2];
      }
    }
  }

  if (bestPair) {
    pairs.push({
      id: `pair-${pairs.length}`,
      players: bestPair,
      avgSkill: (getPlayerSkill(bestPair[0]) + getPlayerSkill(bestPair[1])) / 2
    });
    usedPlayers.add(bestPair[0].id);
    usedPlayers.add(bestPair[1].id);
    playersToMatch.splice(playersToMatch.findIndex(p => p.id === bestPair[0].id), 1);
    playersToMatch.splice(playersToMatch.findIndex(p => p.id === bestPair[1].id), 1);
  } else {
    break;
  }
}

if (pairs.length < 2) {
  alert('Not enough players to form matches');
  return;
}

// Match pairs against each other based on similar combined skill
const matches = [];
const usedPairs = new Set();

// Sort pairs by average skill
pairs.sort((a, b) => b.avgSkill - a.avgSkill);

for (let i = 0; i < pairs.length; i++) {
  if (usedPairs.has(i)) continue;
  
  let bestOpponent = -1;
  let bestScore = -Infinity;

  for (let j = i + 1; j < pairs.length; j++) {
    if (usedPairs.has(j)) continue;
    
    const pair1 = pairs[i];
    const pair2 = pairs[j];
    
    // Calculate opposition score
    let oppCount = 0;
    pair1.players.forEach(p1 => {
      pair2.players.forEach(p2 => {
        oppCount += (oppositionHistory[p1.id]?.[p2.id] || 0);
      });
    });
    
    const skillDiff = Math.abs(pair1.avgSkill - pair2.avgSkill);
    
    // Prefer: haven't played against (high priority), similar combined skill (high priority)
    const score = -oppCount * 100 - skillDiff * 50;
    
    if (score > bestScore) {
      bestScore = score;
      bestOpponent = j;
    }
  }

  if (bestOpponent !== -1) {
    matches.push({
      id: `r${rounds.length}-m${matches.length}`,
      pair1: pairs[i],
      pair2: pairs[bestOpponent],
      score1: 0,
      score2: 0,
      completed: false
    });
    usedPairs.add(i);
    usedPairs.add(bestOpponent);
  }
}

if (matches.length > 0) {
  setRounds(prevRounds => {
    const newRound = {
      id: prevRounds.length,
      matches: matches,
      completed: false,
      sittingOut: sittingOut
    };
    return [...prevRounds, newRound];
  });
}
```

};

// Add a new player
const addPlayer = () => {
if (newPlayerName.trim()) {
const newPlayer = {
id: Date.now().toString(),
name: newPlayerName.trim(),
points: 0,
matchesPlayed: 0,
wins: 0,
losses: 0,
active: true,
sitOutCount: 0
};

```
  const updatedPlayers = [...players, newPlayer];
  setPlayers(updatedPlayers);
  setNewPlayerName('');
  
  // Initialize history for new player
  initializePlayerHistory(newPlayer.id);
}
```

};

// Toggle player active/inactive status (temporary - e.g., bathroom break)
const togglePlayerActive = (playerId) => {
const updatedPlayers = players.map(p =>
p.id === playerId ? { …p, active: !p.active } : p
);
setPlayers(updatedPlayers);
};

// Permanently remove a player (only before tournament starts)
const removePlayer = (playerId) => {
setPlayers(players.filter(p => p.id !== playerId));
};

// Start tournament and auto-generate first round
const startTournament = () => {
const activePlayers = players.filter(p => p.active);
if (activePlayers.length >= 4) {
setTournamentStarted(true);
// Initialize history for all players
players.forEach(p => initializePlayerHistory(p.id));
// Auto-generate first round
setTimeout(() => {
generateNextRound();
}, 100);
} else {
alert(‘Need at least 4 players to start tournament’);
}
};

// Update match score
const updateScore = (roundId, matchId, team, delta) => {
setRounds(prevRounds => prevRounds.map(round => {
if (round.id === roundId) {
return {
…round,
matches: round.matches.map(match => {
if (match.id === matchId) {
const newScore1 = team === 1 ? Math.max(0, match.score1 + delta) : match.score1;
const newScore2 = team === 2 ? Math.max(0, match.score2 + delta) : match.score2;
return {
…match,
score1: newScore1,
score2: newScore2
};
}
return match;
})
};
}
return round;
}));
};

// Complete a match and update player stats and history
const completeMatch = (roundId, matchId, preventAutoGenerate = false) => {
const round = rounds.find(r => r.id === roundId);
const match = round.matches.find(m => m.id === matchId);

```
if (!match.completed) {
  // Update player points and stats
  const updatedPlayers = [...players];
  
  const pair1PlayerIds = match.pair1.players.map(p => p.id);
  const pair2PlayerIds = match.pair2.players.map(p => p.id);
  
  pair1PlayerIds.forEach(playerId => {
    const player = updatedPlayers.find(p => p.id === playerId);
    if (player) {
      player.points += match.score1;
      player.matchesPlayed += 1;
      if (match.score1 > match.score2) player.wins += 1;
      else if (match.score1 < match.score2) player.losses += 1;
    }
  });
  
  pair2PlayerIds.forEach(playerId => {
    const player = updatedPlayers.find(p => p.id === playerId);
    if (player) {
      player.points += match.score2;
      player.matchesPlayed += 1;
      if (match.score2 > match.score1) player.wins += 1;
      else if (match.score2 < match.score1) player.losses += 1;
    }
  });
  
  // Update sit-out count if someone sat out this round
  if (round.sittingOut) {
    if (round.sittingOut.players) {
      // Multiple players sitting out
      round.sittingOut.players.forEach(p => {
        const player = updatedPlayers.find(pl => pl.id === p.id);
        if (player) player.sitOutCount = (player.sitOutCount || 0) + 1;
      });
    } else {
      // Single player sitting out
      const player = updatedPlayers.find(p => p.id === round.sittingOut.id);
      if (player) player.sitOutCount = (player.sitOutCount || 0) + 1;
    }
  }
  
  setPlayers(updatedPlayers);
  
  // Update partnership history
  const newPartnershipHistory = { ...partnershipHistory };
  [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
    const [p1, p2] = pairIds;
    if (!newPartnershipHistory[p1]) newPartnershipHistory[p1] = {};
    if (!newPartnershipHistory[p2]) newPartnershipHistory[p2] = {};
    newPartnershipHistory[p1][p2] = (newPartnershipHistory[p1][p2] || 0) + 1;
    newPartnershipHistory[p2][p1] = (newPartnershipHistory[p2][p1] || 0) + 1;
  });
  setPartnershipHistory(newPartnershipHistory);
  
  // Update opposition history
  const newOppositionHistory = { ...oppositionHistory };
  pair1PlayerIds.forEach(p1 => {
    pair2PlayerIds.forEach(p2 => {
      if (!newOppositionHistory[p1]) newOppositionHistory[p1] = {};
      if (!newOppositionHistory[p2]) newOppositionHistory[p2] = {};
      newOppositionHistory[p1][p2] = (newOppositionHistory[p1][p2] || 0) + 1;
      newOppositionHistory[p2][p1] = (newOppositionHistory[p2][p1] || 0) + 1;
    });
  });
  setOppositionHistory(newOppositionHistory);
  
  // Mark match as completed
  setRounds(prevRounds => {
    const updatedRounds = prevRounds.map(r => {
      if (r.id === roundId) {
        const updatedMatches = r.matches.map(m => 
          m.id === matchId ? { ...m, completed: true } : m
        );
        const allMatchesComplete = updatedMatches.every(m => m.completed);
        return {
          ...r,
          matches: updatedMatches,
          completed: allMatchesComplete
        };
      }
      return r;
    });
    
    // Check if this round is now complete and auto-generate next round (unless prevented)
    if (!preventAutoGenerate) {
      const completedRound = updatedRounds.find(r => r.id === roundId);
      if (completedRound && completedRound.completed) {
        // Use setTimeout to ensure state updates have propagated
        setTimeout(() => {
          generateNextRound();
        }, 100);
      }
    }
    
    return updatedRounds;
  });
}
```

};

// Start editing a match
const startEditingMatch = (roundId, matchId) => {
const round = rounds.find(r => r.id === roundId);
const match = round.matches.find(m => m.id === matchId);

```
if (!match.completed) return;

// Remove the match's contribution from player stats
const updatedPlayers = [...players];
const pair1PlayerIds = match.pair1.players.map(p => p.id);
const pair2PlayerIds = match.pair2.players.map(p => p.id);

pair1PlayerIds.forEach(playerId => {
  const player = updatedPlayers.find(p => p.id === playerId);
  if (player) {
    player.points -= match.score1;
    player.matchesPlayed -= 1;
    if (match.score1 > match.score2) player.wins -= 1;
    else if (match.score1 < match.score2) player.losses -= 1;
  }
});

pair2PlayerIds.forEach(playerId => {
  const player = updatedPlayers.find(p => p.id === playerId);
  if (player) {
    player.points -= match.score2;
    player.matchesPlayed -= 1;
    if (match.score2 > match.score1) player.wins -= 1;
    else if (match.score2 < match.score1) player.losses -= 1;
  }
});

setPlayers(updatedPlayers);

// Remove partnership history
const newPartnershipHistory = { ...partnershipHistory };
[pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
  const [p1, p2] = pairIds;
  if (newPartnershipHistory[p1]?.[p2]) {
    newPartnershipHistory[p1][p2] = Math.max(0, newPartnershipHistory[p1][p2] - 1);
  }
  if (newPartnershipHistory[p2]?.[p1]) {
    newPartnershipHistory[p2][p1] = Math.max(0, newPartnershipHistory[p2][p1] - 1);
  }
});
setPartnershipHistory(newPartnershipHistory);

// Remove opposition history
const newOppositionHistory = { ...oppositionHistory };
pair1PlayerIds.forEach(p1 => {
  pair2PlayerIds.forEach(p2 => {
    if (newOppositionHistory[p1]?.[p2]) {
      newOppositionHistory[p1][p2] = Math.max(0, newOppositionHistory[p1][p2] - 1);
    }
    if (newOppositionHistory[p2]?.[p1]) {
      newOppositionHistory[p2][p1] = Math.max(0, newOppositionHistory[p2][p1] - 1);
    }
  });
});
setOppositionHistory(newOppositionHistory);

// Mark match as not completed and set as editing
setRounds(prevRounds => prevRounds.map(r => {
  if (r.id === roundId) {
    return {
      ...r,
      matches: r.matches.map(m => 
        m.id === matchId ? { ...m, completed: false } : m
      ),
      completed: false
    };
  }
  return r;
}));

setEditingMatch({ roundId, matchId });
```

};

// Save edited match
const saveEditedMatch = (roundId, matchId) => {
completeMatch(roundId, matchId, true); // true = prevent auto-generate
setEditingMatch(null);
};

// Cancel editing
const cancelEditingMatch = (roundId, matchId) => {
// Restore original state by re-completing with current scores
completeMatch(roundId, matchId, true);
setEditingMatch(null);
};

// Delete a match
const deleteMatch = (roundId, matchId) => {
if (!window.confirm(‘Are you sure you want to delete this match? This action cannot be undone.’)) {
return;
}

```
const round = rounds.find(r => r.id === roundId);
const match = round.matches.find(m => m.id === matchId);

if (match.completed) {
  // Remove the match's contribution from player stats
  const updatedPlayers = [...players];
  const pair1PlayerIds = match.pair1.players.map(p => p.id);
  const pair2PlayerIds = match.pair2.players.map(p => p.id);
  
  pair1PlayerIds.forEach(playerId => {
    const player = updatedPlayers.find(p => p.id === playerId);
    if (player) {
      player.points -= match.score1;
      player.matchesPlayed -= 1;
      if (match.score1 > match.score2) player.wins -= 1;
      else if (match.score1 < match.score2) player.losses -= 1;
    }
  });
  
  pair2PlayerIds.forEach(playerId => {
    const player = updatedPlayers.find(p => p.id === playerId);
    if (player) {
      player.points -= match.score2;
      player.matchesPlayed -= 1;
      if (match.score2 > match.score1) player.wins -= 1;
      else if (match.score2 < match.score1) player.losses -= 1;
    }
  });
  
  setPlayers(updatedPlayers);
  
  // Remove partnership history
  const newPartnershipHistory = { ...partnershipHistory };
  [pair1PlayerIds, pair2PlayerIds].forEach(pairIds => {
    const [p1, p2] = pairIds;
    if (newPartnershipHistory[p1]?.[p2]) {
      newPartnershipHistory[p1][p2] = Math.max(0, newPartnershipHistory[p1][p2] - 1);
    }
    if (newPartnershipHistory[p2]?.[p1]) {
      newPartnershipHistory[p2][p1] = Math.max(0, newPartnershipHistory[p2][p1] - 1);
    }
  });
  setPartnershipHistory(newPartnershipHistory);
  
  // Remove opposition history
  const newOppositionHistory = { ...oppositionHistory };
  pair1PlayerIds.forEach(p1 => {
    pair2PlayerIds.forEach(p2 => {
      if (newOppositionHistory[p1]?.[p2]) {
        newOppositionHistory[p1][p2] = Math.max(0, newOppositionHistory[p1][p2] - 1);
      }
      if (newOppositionHistory[p2]?.[p1]) {
        newOppositionHistory[p2][p1] = Math.max(0, newOppositionHistory[p2][p1] - 1);
      }
    });
  });
  setOppositionHistory(newOppositionHistory);
}

// Remove match from round - DO NOT trigger auto-generation
setRounds(prevRounds => prevRounds.map(r => {
  if (r.id === roundId) {
    const updatedMatches = r.matches.filter(m => m.id !== matchId);
    return {
      ...r,
      matches: updatedMatches,
      completed: updatedMatches.length > 0 ? updatedMatches.every(m => m.completed) : false
    };
  }
  return r;
}));
```

};

// Initiate finals with top 4 players
const initiateFinals = () => {
const leaderboard = getLeaderboard();

```
if (leaderboard.length < 4) {
  alert('Need at least 4 players who have played matches to start finals');
  return;
}

// Get top 4 players
const top4 = leaderboard.slice(0, 4);

// Create pairs: 1st & 4th vs 2nd & 3rd
const pair1 = {
  id: 'finals-pair1',
  players: [top4[0], top4[3]],
  name: `${top4[0].name} & ${top4[3].name}`
};

const pair2 = {
  id: 'finals-pair2',
  players: [top4[1], top4[2]],
  name: `${top4[1].name} & ${top4[2].name}`
};

// Create finals match - single game to 40 with golden point at deuce
const finals = {
  id: 'finals',
  pair1: pair1,
  pair2: pair2,
  score1: 0,
  score2: 0,
  winner: null,
  completed: false,
  isGoldenPoint: false
};

setFinalsMatch(finals);
setFinalsMode(true);
```

};

// Update finals score (single game with golden point at deuce)
const updateFinalsScore = (team, point) => {
if (!finalsMatch || finalsMatch.completed) return;

```
const match = { ...finalsMatch };

// Update points
if (team === 1) {
  match.score1 = Math.max(0, match.score1 + point);
} else {
  match.score2 = Math.max(0, match.score2 + point);
}

// Check for golden point (deuce)
if (match.score1 === 3 && match.score2 === 3) {
  match.isGoldenPoint = true;
}

// Check if someone won
// Regular win: reach 4 points with 2-point lead, OR
// Golden point win: reach 4 points when it's golden point
if (match.score1 >= 4 || match.score2 >= 4) {
  if (match.isGoldenPoint) {
    // Golden point - next point wins
    if (match.score1 > match.score2) {
      match.winner = 1;
    } else if (match.score2 > match.score1) {
      match.winner = 2;
    }
  } else {
    // Regular scoring - need 2 point lead
    if (match.score1 >= 4 && match.score1 - match.score2 >= 2) {
      match.winner = 1;
    } else if (match.score2 >= 4 && match.score2 - match.score1 >= 2) {
      match.winner = 2;
    }
  }
}

setFinalsMatch(match);
```

};

// Complete the finals match
const completeFinalsMatch = () => {
if (!finalsMatch || !finalsMatch.winner) {
alert(‘Please finish the game before completing the match’);
return;
}

```
const match = { ...finalsMatch };
match.completed = true;
setFinalsMatch(match);
```

};

// Get point display for padel scoring (0, 15, 30, 40)
const getPointDisplay = (score1, score2) => {
const pointMap = { 0: ‘0’, 1: ‘15’, 2: ‘30’, 3: ‘40’ };

```
// If both haven't reached 40 yet
if (score1 <= 3 && score2 <= 3) {
  return { p1: pointMap[score1] || '40', p2: pointMap[score2] || '40' };
}

// Someone has gone beyond 40
return { p1: score1 >= 4 ? 'W' : '40', p2: score2 >= 4 ? 'W' : '40' };
```

};

const resetTournament = () => {
setPlayers(players.map(p => ({
…p,
points: 0,
matchesPlayed: 0,
wins: 0,
losses: 0,
active: true,
sitOutCount: 0
})));
setRounds([]);
setTournamentStarted(false);
setPartnershipHistory({});
setOppositionHistory({});
setFinalsMode(false);
setFinalsMatch(null);
};

// Get sorted leaderboard (includes all players, both active and inactive)
const getLeaderboard = () => {
const playersWithStats = […players]
.filter(p => p.matchesPlayed > 0) // Only show players who have played
.map(p => ({
…p,
ppg: p.matchesPlayed > 0 ? (p.points / p.matchesPlayed).toFixed(2) : 0,
winRate: p.matchesPlayed > 0 ? ((p.wins / p.matchesPlayed) * 100).toFixed(1) : 0
}));

```
if (leaderboardMode === 'ppg') {
  return playersWithStats.sort((a, b) => {
    // Primary: Points per game (PPG)
    const ppgDiff = parseFloat(b.ppg) - parseFloat(a.ppg);
    if (Math.abs(ppgDiff) > 0.001) return ppgDiff;
    
    // Secondary: Total matches played (more matches = slight advantage when PPG equal)
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    
    // Tertiary: Win rate
    return parseFloat(b.winRate) - parseFloat(a.winRate);
  });
} else {
  return playersWithStats.sort((a, b) => {
    // Primary: Total points
    if (b.points !== a.points) return b.points - a.points;
    
    // Secondary: Win rate
    return parseFloat(b.winRate) - parseFloat(a.winRate);
  });
}
```

};

return (
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
<div className="max-w-6xl mx-auto">
<div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
<div className="flex items-center gap-3 mb-6">
<div className="p-3 bg-green-500 rounded-xl">
<Trophy className="w-8 h-8 text-white" />
</div>
<div>
<h1 className="text-3xl font-bold text-gray-800">Padel Indiano</h1>
<p className="text-gray-600">Dynamic skill-based pairing</p>
</div>
</div>

```
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('tournament')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'tournament'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Tournament
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'rules'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          How to Play
        </button>
      </div>

      {/* Tournament Tab */}
      {activeTab === 'tournament' && (
      <div>
        {/* Player Management */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Players ({players.filter(p => p.active).length} active)
          </h2>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Enter player name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={addPlayer}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Show all players */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map(player => (
            <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg border ${
              player.active 
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-gray-100 border-gray-300 opacity-60'
            }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${!player.active ? 'text-gray-500' : ''}`}>
                    {player.name}
                  </span>
                  {!player.active && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">Away</span>
                  )}
                </div>
                {tournamentStarted && player.matchesPlayed > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {player.matchesPlayed} games | {player.sitOutCount || 0} sit-outs
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {tournamentStarted ? (
                  <button
                    onClick={() => togglePlayerActive(player.id)}
                    className={`transition-colors ${
                      player.active 
                        ? 'text-orange-500 hover:text-orange-700' 
                        : 'text-green-500 hover:text-green-700'
                    }`}
                    title={player.active ? 'Mark as away (temporarily inactive)' : 'Mark as back (active)'}
                  >
                    {player.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                ) : (
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Remove player"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {players.filter(p => p.active).length < 4 && (
          <p className="text-amber-600 mt-3 text-sm">
            Add at least 4 active players to start the tournament
          </p>
        )}
        
        {tournamentStarted && (
          <p className="text-blue-600 mt-3 text-sm">
            💡 Players are dynamically paired each round based on skill level. Toggle players away (orange) when they take breaks - they'll be automatically skipped in new rounds. New rounds generate automatically when all matches complete.
          </p>
        )}
      </div>

      {/* Tournament Controls */}
      {!tournamentStarted && players.filter(p => p.active).length >= 4 && (
        <button
          onClick={startTournament}
          className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2 font-semibold transition-colors"
        >
          <Play className="w-5 h-5" />
          Start Tournament
        </button>
      )}

      {tournamentStarted && !finalsMode && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={initiateFinals}
              disabled={getLeaderboard().length < 4}
              className="flex-1 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors"
            >
              <Trophy className="w-5 h-5" />
              Initiate Finals
            </button>
            <button
              onClick={resetTournament}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2 font-semibold transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>
          <p className="text-sm text-gray-600 text-center">
            ⚡ Rounds generate automatically when all matches complete
          </p>
        </div>
      )}

    {/* Finals Match */}
    {finalsMode && finalsMatch && (
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            FINALS - Single Game
          </h2>
          {finalsMatch.winner && !finalsMatch.completed && (
            <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
              Game Complete - Click "Complete Match"
            </span>
          )}
          {finalsMatch.completed && (
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold">
              ✓ Match Complete
            </span>
          )}
        </div>

        {!finalsMatch.completed && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Match Display */}
            <div className="space-y-4">
              {/* Golden Point Indicator */}
              {finalsMatch.isGoldenPoint && !finalsMatch.winner && (
                <div className="bg-gradient-to-r from-red-100 to-orange-100 p-4 rounded-lg border-2 border-red-400">
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-700">⚡ GOLDEN POINT ⚡</div>
                    <div className="text-sm text-red-600 mt-1">Next point wins!</div>
                  </div>
                </div>
              )}

              {/* Score Display */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center">SCORE</h3>
                
                <div className="flex items-center justify-between p-6 bg-blue-50 rounded-lg border-2 border-blue-300 mb-3">
                  <div>
                    <div className="font-bold text-xl text-gray-800">{finalsMatch.pair1.players[0].name}</div>
                    <div className="font-bold text-xl text-gray-800">{finalsMatch.pair1.players[1].name}</div>
                  </div>
                  <div className="text-6xl font-bold text-blue-600">
                    {getPointDisplay(finalsMatch.score1, finalsMatch.score2).p1}
                  </div>
                </div>

                <div className="text-center text-2xl font-bold text-gray-400 my-2">VS</div>

                <div className="flex items-center justify-between p-6 bg-orange-50 rounded-lg border-2 border-orange-300">
                  <div>
                    <div className="font-bold text-xl text-gray-800">{finalsMatch.pair2.players[0].name}</div>
                    <div className="font-bold text-xl text-gray-800">{finalsMatch.pair2.players[1].name}</div>
                  </div>
                  <div className="text-6xl font-bold text-orange-600">
                    {getPointDisplay(finalsMatch.score1, finalsMatch.score2).p2}
                  </div>
                </div>
              </div>

              {/* Winner Announcement */}
              {finalsMatch.winner && (
                <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-6 rounded-lg border-2 border-green-400">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-800 mb-2">🎉 GAME WON! 🎉</div>
                    <div className="text-xl font-semibold text-green-700">
                      {finalsMatch.winner === 1 ? finalsMatch.pair1.name : finalsMatch.pair2.name}
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      Final Score: {getPointDisplay(finalsMatch.score1, finalsMatch.score2).p1} - {getPointDisplay(finalsMatch.score1, finalsMatch.score2).p2}
                    </div>
                  </div>
                </div>
              )}

              {/* Rules Reminder */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-2 text-sm">Scoring Rules</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Traditional scoring: 0, 15, 30, 40</li>
                  <li>• At 40-40 (deuce): Golden Point - next point wins!</li>
                  <li>• First to 40 with 2-point lead wins (before deuce)</li>
                </ul>
              </div>
            </div>

            {/* Scoring Controls */}
            <div className="space-y-4">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-gray-800 mb-4 text-center text-lg">Pair 1 Score</h4>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => updateFinalsScore(1, 1)}
                    disabled={!!finalsMatch.winner}
                    className="px-8 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                  >
                    + Point
                  </button>
                  <button
                    onClick={() => updateFinalsScore(1, -1)}
                    disabled={!!finalsMatch.winner}
                    className="px-8 py-4 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                  >
                    - Point
                  </button>
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                <h4 className="font-semibold text-gray-800 mb-4 text-center text-lg">Pair 2 Score</h4>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => updateFinalsScore(2, 1)}
                    disabled={!!finalsMatch.winner}
                    className="px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                  >
                    + Point
                  </button>
                  <button
                    onClick={() => updateFinalsScore(2, -1)}
                    disabled={!!finalsMatch.winner}
                    className="px-8 py-4 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                  >
                    - Point
                  </button>
                </div>
              </div>

              {/* Complete Match Button */}
              {finalsMatch.winner && (
                <button
                  onClick={completeFinalsMatch}
                  className="w-full py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  Complete Match & Crown Champions
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tournament Winners Display */}
        {finalsMatch.completed && (
          <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-8 rounded-2xl border-4 border-yellow-400">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-4xl font-bold text-gray-800 mb-2">TOURNAMENT CHAMPIONS</h2>
              <div className="h-1 w-32 bg-yellow-400 mx-auto rounded"></div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-4">
                  {finalsMatch.winner === 1 ? finalsMatch.pair1.name : finalsMatch.pair2.name}
                </div>
                <div className="space-y-2">
                  <div className="text-xl text-gray-700">
                    {finalsMatch.winner === 1 ? (
                      <>
                        <div>{finalsMatch.pair1.players[0].name}</div>
                        <div>{finalsMatch.pair1.players[1].name}</div>
                      </>
                    ) : (
                      <>
                        <div>{finalsMatch.pair2.players[0].name}</div>
                        <div>{finalsMatch.pair2.players[1].name}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="font-semibold text-gray-800 mb-4 text-center">Finals Result</h3>
              <div className="grid grid-cols-3 gap-4 items-center text-center">
                <div>
                  <div className="font-semibold text-gray-700">{finalsMatch.pair1.name}</div>
                  <div className="text-sm text-gray-600">
                    {finalsMatch.pair1.players[0].name}<br/>
                    {finalsMatch.pair1.players[1].name}
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-800">
                  {getPointDisplay(finalsMatch.score1, finalsMatch.score2).p1} - {getPointDisplay(finalsMatch.score1, finalsMatch.score2).p2}
                </div>
                <div>
                  <div className="font-semibold text-gray-700">{finalsMatch.pair2.name}</div>
                  <div className="text-sm text-gray-600">
                    {finalsMatch.pair2.players[0].name}<br/>
                    {finalsMatch.pair2.players[1].name}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={resetTournament}
                className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition-colors"
              >
                Start New Tournament
              </button>
            </div>
          </div>
        )}
      </div>
    )}

    {/* Rounds and Matches */}
    {tournamentStarted && rounds.length > 0 && !finalsMode && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {rounds.map((round, idx) => (
            <div key={round.id} className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    Round {idx + 1}
                  </h3>
                  {round.sittingOut && (
                    <p className="text-sm text-orange-600 mt-1">
                      Sitting out: {round.sittingOut.name || round.sittingOut.players?.map(p => p.name).join(', ')}
                    </p>
                  )}
                </div>
                {round.completed && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Completed
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {round.matches.map(match => (
                  <div key={match.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      {/* Pair 1 */}
                      <div className="space-y-1">
                        {match.pair1.players.map(player => (
                          <div key={player.id} className={`font-medium ${!player.active ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {player.name}
                          </div>
                        ))}
                      </div>

                      {/* Score */}
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => updateScore(round.id, match.id, 1, 1)}
                            disabled={match.completed && editingMatch?.matchId !== match.id}
                            className="w-10 h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors"
                          >
                            +
                          </button>
                          <div className="text-3xl font-bold text-gray-800">
                            {match.score1}
                          </div>
                          <button
                            onClick={() => updateScore(round.id, match.id, 1, -1)}
                            disabled={match.completed && editingMatch?.matchId !== match.id}
                            className="w-10 h-10 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors"
                          >
                            -
                          </button>
                        </div>

                        <div className="text-2xl font-bold text-gray-400">:</div>

                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => updateScore(round.id, match.id, 2, 1)}
                            disabled={match.completed && editingMatch?.matchId !== match.id}
                            className="w-10 h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors"
                          >
                            +
                          </button>
                          <div className="text-3xl font-bold text-gray-800">
                            {match.score2}
                          </div>
                          <button
                            onClick={() => updateScore(round.id, match.id, 2, -1)}
                            disabled={match.completed && editingMatch?.matchId !== match.id}
                            className="w-10 h-10 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors"
                          >
                            -
                          </button>
                        </div>
                      </div>

                      {/* Pair 2 */}
                      <div className="space-y-1 text-right">
                        {match.pair2.players.map(player => (
                          <div key={player.id} className={`font-medium ${!player.active ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {player.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Match Actions */}
                    {!match.completed && (
                      <button
                        onClick={() => completeMatch(round.id, match.id)}
                        className="w-full mt-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors"
                      >
                        Complete Match
                      </button>
                    )}

                    {match.completed && (!editingMatch || editingMatch?.matchId !== match.id) && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => startEditingMatch(round.id, match.id)}
                          className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMatch(round.id, match.id)}
                          className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    {match.completed && editingMatch?.matchId === match.id && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => saveEditedMatch(round.id, match.id)}
                          className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => cancelEditingMatch(round.id, match.id)}
                          className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                Leaderboard
              </h3>
            </div>
            
            {/* Toggle between PPG and Total Points */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setLeaderboardMode('ppg')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  leaderboardMode === 'ppg'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Points/Game
              </button>
              <button
                onClick={() => setLeaderboardMode('total')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  leaderboardMode === 'total'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Total Points
              </button>
            </div>
            
            <div className="space-y-2">
              {getLeaderboard().map((player, idx) => (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg ${
                    !player.active
                      ? 'bg-gray-100 border border-gray-300 opacity-75'
                      : idx === 0
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-400'
                      : idx === 1
                      ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-400'
                      : idx === 2
                      ? 'bg-gradient-to-r from-orange-100 to-orange-50 border-2 border-orange-400'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`text-xl font-bold ${
                        !player.active ? 'text-gray-400' :
                        idx === 0 ? 'text-yellow-600' :
                        idx === 1 ? 'text-gray-600' :
                        idx === 2 ? 'text-orange-600' :
                        'text-gray-500'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${!player.active ? 'text-gray-500' : ''}`}>
                            {player.name}
                          </span>
                          {!player.active && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">Away</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {player.matchesPlayed} games | {player.wins}W-{player.losses}L ({player.winRate}%)
                          {player.sitOutCount > 0 && ` | ${player.sitOutCount} sit-out${player.sitOutCount > 1 ? 's' : ''}`}
                        </div>
                        {leaderboardMode === 'ppg' ? (
                          <div className="text-xs text-gray-500">
                            {player.points} total pts
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            {player.ppg} pts/game
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${!player.active ? 'text-gray-400' : 'text-gray-800'}`}>
                        {leaderboardMode === 'ppg' ? player.ppg : player.points}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        {leaderboardMode === 'ppg' ? 'PPG' : 'PTS'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {getLeaderboard().length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No matches completed yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  )}

  {/* Rules Tab */}
  {activeTab === 'rules' && (
    <div className="prose max-w-none">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">What is Padel Indiano?</h2>
      
      <p className="text-gray-700 mb-4">
        Padel Indiano is a dynamic tournament format where players are continuously re-paired based on their performance. Unlike traditional formats where you play with the same partner throughout, Indiano ensures everyone plays with different partners, creating a fair and social experience.
      </p>

      <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">How It Works</h3>
      
      <div className="space-y-4 text-gray-700">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">1. Dynamic Pairing</h4>
          <p>Players are automatically paired each round based on their current skill level (Points Per Game). Similar-skilled players team up together, and pairs of similar combined strength play against each other.</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">2. Skill-Based Matching</h4>
          <p>The algorithm ensures competitive matches by pairing players of similar abilities while maximizing variety - you'll play with as many different partners as possible.</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">3. Automatic Rounds</h4>
          <p>When all matches in a round complete, the next round generates automatically with new pairings based on updated standings.</p>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">4. Fair Play Time</h4>
          <p>With odd numbers of players, the system rotates who sits out to ensure everyone gets approximately equal court time.</p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">Scoring</h3>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <h4 className="font-semibold text-gray-800 mb-2">Regular Rounds</h4>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Matches are typically played to a set number of points (e.g., 24 or 32 points)</li>
          <li>Both players in a pair earn the same points for their team's score</li>
          <li>Rankings are based on Points Per Game (PPG) to ensure fairness regardless of how many games played</li>
        </ul>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg mb-4">
        <h4 className="font-semibold text-gray-800 mb-2">Finals</h4>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Top 4 players form two pairs: 1st & 4th vs 2nd & 3rd</li>
          <li>Played as a single game with traditional scoring (0-15-30-40)</li>
          <li>First to 40 with 2-point lead wins (before deuce)</li>
          <li><strong>Golden Point at Deuce:</strong> When it's 40-40, the next point wins the game!</li>
          <li>Winners are crowned as tournament champions</li>
        </ul>
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-3 mt-6">Tournament Management</h3>
      
      <div className="space-y-3 text-gray-700">
        <p><strong>Adding Players:</strong> Add new players at any time - they'll be included in the next round generation.</p>
        
        <p><strong>Player Status:</strong> Toggle players "away" (orange icon) when they take breaks. They'll be skipped in new rounds but stay on the leaderboard. Toggle back when they return.</p>
        
        <p><strong>Flexibility:</strong> No minimum round requirement - play as many or as few rounds as your time allows!</p>
      </div>

      <div className="bg-green-100 border-l-4 border-green-500 p-4 mt-6">
        <p className="font-semibold text-gray-800 mb-2">Pro Tip</p>
        <p className="text-gray-700">Indiano format is perfect for social play! Everyone gets to partner with different players, skill levels balance naturally, and the competition stays exciting throughout.</p>
      </div>
    </div>
  )}
    </div>
  </div>
</div>
```

);
};

export default PadelIndiano;
