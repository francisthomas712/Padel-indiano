import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, TextInput
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';

// Shared core (verbatim from the web app)
import { Player, Match, Round, Pair } from './src/core/types';
import { getNextServer, getPreviousServer, getServerInfo, checkMatchWinner } from './src/core/scoring';
import { generatePairs, generateSnakePairs, matchPairs, findPlayersToSitOut } from './src/core/pairingAlgorithm';
import { calculatePairRating, calculateWeightedPoints, updateMatchElo, INITIAL_ELO } from './src/core/elo';
import { loadGroups, saveGroup, normalizeGroupName, Group } from './src/core/groups';

// App services
import { useTournamentState } from './src/hooks/useTournamentState';
import {
  configurePurchases, getAccess, AccessState
} from './src/services/entitlement';
import {
  hapticPoint, hapticCorrection, hapticWin, publishLiveState,
  LiveScoreboard, buildSnapshot
} from './src/services/api';

type ServerPos = 'pair1-p1' | 'pair1-p2' | 'pair2-p1' | 'pair2-p2';

const resolveServerName = (server: ServerPos | undefined, pair1: Pair, pair2: Pair): string | null => {
  const info = getServerInfo(server as never);
  const servingPair = info.pair === 1 ? pair1 : pair2;
  return servingPair.players[info.slot]?.name ?? null;
};

const C = {
  bg: '#0f172a', card: '#1e293b', cardSoft: '#1e293b88', line: '#334155',
  text: '#f1f5f9', dim: '#94a3b8', green: '#22c55e', greenDark: '#16a34a',
  yellow: '#eab308', orange: '#f97316', red: '#ef4444', blue: '#3b82f6', indigo: '#6366f1'
};

export default function App() {
  useKeepAwake();
  const { state, updateState, undo } = useTournamentState();
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [groupName, setGroupName] = useState(state.groupName ?? '');
  const [newPlayer, setNewPlayer] = useState('');
  const [newElo, setNewElo] = useState('');
  const [courts, setCourts] = useState(state.settings.courts ?? 2);
  const [courtMode, setCourtMode] = useState<{ roundId: number; matchId: string } | null>(null);

  useEffect(() => {
    configurePurchases().finally(() => {
      getAccess().then(setAccess);
    });
  }, []);

  // Publish live snapshot when a group session is running
  useEffect(() => {
    if (!state.groupName || !state.tournamentStarted) return;
    // Snapshot built from current state (boards computed inline for brevity)
    const boards: LiveScoreboard[] = [];
    state.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.completed) return;
        boards.push({
          id: match.id,
          title: `Court ${match.court ?? 1}`,
          team1Name: match.pair1.name ?? match.pair1.players.map(p => p.name).join(' & '),
          team2Name: match.pair2.name ?? match.pair2.players.map(p => p.name).join(' & '),
          score1: match.score1, score2: match.score2,
          pointsToWin: state.settings.pointsToWin,
          serverName: resolveServerName(match.currentServer as ServerPos, match.pair1, match.pair2)
        });
      });
    });
    publishLiveState(buildSnapshot(state.groupName, state, boards, [], 'ppg'));
  }, [state]);

  const locked = access !== null && !access.hasAccess;

  // ---------- actions ----------
  const addPlayer = useCallback(() => {
    if (!newPlayer.trim()) return;
    const elo = parseInt(newElo, 10);
    const player: Player = {
      id: Date.now().toString(),
      name: newPlayer.trim(),
      points: 0, matchesPlayed: 0, wins: 0, losses: 0, active: true, sitOutCount: 0,
      eloRating: isNaN(elo) ? INITIAL_ELO : elo,
      initialElo: isNaN(elo) ? INITIAL_ELO : elo
    };
    updateState({ players: [...state.players, player] }, {
      type: 'player_add', timestamp: Date.now(), data: { player }
    });
    setNewPlayer(''); setNewElo('');
  }, [newPlayer, newElo, state.players, updateState]);

  const saveCurrentGroup = useCallback(() => {
    if (!groupName.trim() || state.players.length === 0) return;
    const result = saveGroup(groupName, state.players.map(p => ({
      name: p.name, eloRating: p.eloRating
    })), state.settings, state.groupName);
    if (!result.ok) {
      Alert.alert('Save group', result.error === 'name-taken'
        ? 'That name belongs to another group'
        : 'Use a single word (letters/numbers/-/_)');
      return;
    }
    updateState({ groupName: result.group.name });
  }, [groupName, state.players, state.settings, state.groupName, updateState]);

  const loadGroup = useCallback((group: Group) => {
    if (state.tournamentStarted) {
      Alert.alert('Tournament running', 'Reset the tournament before loading a group.', [{ text: 'OK' }]);
      return;
    }
    const players: Player[] = group.players.map(p => ({
      id: `${group.key}-${normalizeGroupName(p.name)}`,
      name: p.name, points: 0, matchesPlayed: 0, wins: 0, losses: 0,
      active: true, sitOutCount: 0,
      eloRating: p.eloRating, initialElo: p.eloRating
    }));
    updateState({
      players, groupName: group.name, rounds: [], tournamentStarted: false,
      partnershipHistory: {}, oppositionHistory: {}, finalsMode: false, finalsMatch: null
    });
  }, [state.tournamentStarted, updateState]);

  const toggleActive = useCallback((playerId: string) => {
    hapticPoint();
    updateState({
      players: state.players.map(p => p.id === playerId ? { ...p, active: !p.active } : p)
    }, { type: 'player_toggle', timestamp: Date.now(), data: { playerId } });
  }, [state.players, updateState]);

  const startTournament = useCallback(() => {
    if (state.players.filter(p => p.active).length < 4) {
      Alert.alert('Need players', 'At least 4 active players required.');
      return;
    }
    updateState(
      { tournamentStarted: true, settings: { ...state.settings, courts } },
      { type: 'round_generate', timestamp: Date.now(), data: { started: true, courts } }
    );
    setTimeout(() => generateRound(), 50);
  }, [state.players, state.settings, courts, updateState]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateRound = useCallback(() => {
    const activePlayers = state.players.filter(p => p.active);
    if (activePlayers.length < 4) return;

    let playersToMatch = [...activePlayers];
    let sittingOut: Player | { id: string; name: string; players: Player[] } | null = null;
    const remainder = playersToMatch.length % 4;
    if (remainder === 1 || remainder === 3) {
      const [sitOut] = findPlayersToSitOut(playersToMatch, 1);
      sittingOut = sitOut;
      playersToMatch = playersToMatch.filter(p => p.id !== sitOut.id);
    } else if (remainder === 2) {
      const sitOuts = findPlayersToSitOut(playersToMatch, 2);
      sittingOut = { id: 'multi', name: sitOuts.map(p => p.name).join(', '), players: sitOuts };
      playersToMatch = playersToMatch.filter(p => !sitOuts.some(s => s.id === p.id));
    }

    const useSnake = state.rounds.length % 3 === 2;
    const pairs = useSnake ? generateSnakePairs(playersToMatch) : generatePairs(playersToMatch, state.partnershipHistory);
    if (pairs.length < 2) return;

    const courtCount = state.settings.courts ?? 2;
    const matches = matchPairs(pairs, state.oppositionHistory, state.rounds.length)
      .slice(0, courtCount)
      .map((m, i) => ({ ...m, court: i + 1 }));

    const playingIds = new Set(matches.flatMap(m => [...m.pair1.players.map(p => p.id), ...m.pair2.players.map(p => p.id)]));
    const benched = playersToMatch.filter(p => !playingIds.has(p.id));
    if (benched.length > 0) {
      const existing = sittingOut === null ? [] : 'players' in sittingOut ? sittingOut.players : [sittingOut];
      const all = [...existing, ...benched];
      sittingOut = all.length === 1 ? all[0] : { id: 'multi', name: all.map(p => p.name).join(', '), players: all };
    }

    // Credit sit-outs at generation
    const sitOutPlayers = sittingOut === null ? [] : 'players' in sittingOut ? sittingOut.players : [sittingOut];
    const players = state.players.map(p =>
      sitOutPlayers.some(s => s.id === p.id) ? { ...p, sitOutCount: p.sitOutCount + 1 } : p
    );

    const newRound: Round = { id: state.rounds.length, matches, completed: false, sittingOut };
    updateState({ rounds: [...state.rounds, newRound], players }, {
      type: 'round_generate', timestamp: Date.now(), data: { round: newRound }
    });
  }, [state.players, state.rounds, state.partnershipHistory, state.oppositionHistory, state.settings.courts, updateState]);

  const scorePoint = useCallback((roundId: number, matchId: string, team: 1 | 2, delta: 1 | -1) => {
    if (delta === 1) hapticPoint(); else hapticCorrection();
    const rounds = state.rounds.map(r => r.id !== roundId ? r : {
      ...r,
      matches: r.matches.map(m => {
        if (m.id !== matchId) return m;
        const s1 = team === 1 ? Math.max(0, m.score1 + delta) : m.score1;
        const s2 = team === 2 ? Math.max(0, m.score2 + delta) : m.score2;
        return {
          ...m, score1: s1, score2: s2,
          currentServer: delta === 1 ? getNextServer(m.currentServer as ServerPos) : getPreviousServer(m.currentServer as ServerPos)
        };
      })
    });
    updateState({ rounds }, { type: 'score_update', timestamp: Date.now(), data: { roundId, matchId, team, delta } });
  }, [state.rounds, updateState]);

  const completeMatch = useCallback((roundId: number, matchId: string) => {
    hapticWin();
    const round = state.rounds.find(r => r.id === roundId);
    const match = round?.matches.find(m => m.id === matchId);
    if (!round || !match || match.completed) return;

    const players = state.players.map(p => ({ ...p }));
    const find = (id: string) => players.find(p => p.id === id)!;
    const p1 = match.pair1.players.map(p => find(p.id));
    const p2 = match.pair2.players.map(p => find(p.id));
    const e1 = calculatePairRating(p1[0].eloRating, p1[1].eloRating);
    const e2 = calculatePairRating(p2[0].eloRating, p2[1].eloRating);
    const p1Won = match.score1 > match.score2;
    const w1 = Math.round(calculateWeightedPoints(match.score1, e1, e2, p1Won) * 10) / 10;
    const w2 = Math.round(calculateWeightedPoints(match.score2, e2, e1, !p1Won) * 10) / 10;
    const newElos = updateMatchElo(
      { id: p1[0].id, rating: p1[0].eloRating, matchesPlayed: p1[0].matchesPlayed },
      { id: p1[1].id, rating: p1[1].eloRating, matchesPlayed: p1[1].matchesPlayed },
      { id: p2[0].id, rating: p2[0].eloRating, matchesPlayed: p2[0].matchesPlayed },
      { id: p2[1].id, rating: p2[1].eloRating, matchesPlayed: p2[1].matchesPlayed },
      match.score1, match.score2
    );

    const eloDeltas: Record<string, number> = {};
    [...p1, ...p2].forEach(p => {
      const delta = newElos[p.id] - p.eloRating;
      eloDeltas[p.id] = delta;
      p.eloRating = newElos[p.id];
      p.points += p.id === p1[0].id || p.id === p1[1].id ? w1 : w2;
      p.matchesPlayed += 1;
      const own = p.id === p1[0].id || p.id === p1[1].id ? match.score1 : match.score2;
      const other = p.id === p1[0].id || p.id === p1[1].id ? match.score2 : match.score1;
      if (own > other) p.wins += 1; else if (own < other) p.losses += 1;
    });

    const rounds = state.rounds.map(r => r.id !== roundId ? r : {
      ...r,
      matches: r.matches.map(m => m.id !== matchId ? m : {
        ...m, completed: true, endTime: Date.now(),
        weightedPoints1: w1, weightedPoints2: w2, eloDeltas
      }),
      completed: r.matches.every(m => m.completed || m.id === matchId)
    });

    updateState({ players, rounds }, { type: 'match_complete', timestamp: Date.now(), data: { roundId, matchId } });
    setCourtMode(null);
  }, [state.rounds, state.players, updateState]);

  const currentMatch = useMemo(() => {
    if (!courtMode) return null;
    const round = state.rounds.find(r => r.id === courtMode.roundId);
    return round?.matches.find(m => m.id === courtMode.matchId) ?? null;
  }, [courtMode, state.rounds]);

  const activeCount = state.players.filter(p => p.active).length;
  const groups = loadGroups();

  // Show the paywall when the ledger says locked (effect, not render-phase setState)
  useEffect(() => {
    if (locked) setShowPaywall(true);
  }, [locked]);

  if (showPaywall && locked) {
    return <Paywall access={access} onClose={() => setShowPaywall(false)} onRefresh={() => getAccess().then(setAccess)} />;
  }

  // ---------- court mode ----------
  if (currentMatch) {
    return (
      <CourtMode
        match={currentMatch}
        pointsToWin={state.settings.pointsToWin}
        winByTwo={state.settings.winByTwo ?? false}
        goldenPoint={state.settings.goldenPoint ?? false}
        onPoint={(team, delta) => scorePoint(courtMode!.roundId, courtMode!.matchId, team, delta)}
        onComplete={() => completeMatch(courtMode!.roundId, courtMode!.matchId)}
        onClose={() => setCourtMode(null)}
      />
    );
  }

  // ---------- main screen ----------
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, gap: 16 }}>
        <Text style={{ color: C.text, fontSize: 28, fontWeight: '800' }}>Padel Indiano</Text>
        {access && (
          <Text style={{ color: C.dim, fontSize: 13, marginTop: -10 }}>
            {access.source === 'trial' && access.accessUntil
              ? `Free trial · ${Math.ceil((access.accessUntil - Date.now()) / 86400000)}d left`
              : access.source === 'pass' ? 'Day pass active' : ''}
          </Text>
        )}

        {/* Group */}
        <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 8 }}>
          <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700' }}>GROUP</Text>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="e.g. Pawri"
            placeholderTextColor={C.dim}
            style={{ color: C.text, backgroundColor: '#0f172a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.line }}
          />
          <Pressable onPress={saveCurrentGroup} style={{ backgroundColor: C.greenDark, borderRadius: 8, padding: 10 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Save group</Text>
          </Pressable>
          {Object.values(groups).sort((a, b) => b.updatedAt - a.updatedAt).map(g => (
            <Pressable key={g.key} onPress={() => loadGroup(g)}
              style={{ backgroundColor: C.cardSoft, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>{g.name} <Text style={{ color: C.dim, fontWeight: '400' }}>· {g.players.length} players · tap to load</Text></Text>
            </Pressable>
          ))}
        </View>

        {/* Players */}
        <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 10 }}>
          <Text style={{ color: C.dim, fontSize: 12, fontWeight: '700' }}>PLAYERS ({activeCount} active)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={newPlayer} onChangeText={setNewPlayer}
              onSubmitEditing={addPlayer}
              placeholder="Name" placeholderTextColor={C.dim}
              style={{ flex: 1, color: C.text, backgroundColor: '#0f172a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.line }}
            />
            <TextInput
              value={newElo} onChangeText={setNewElo}
              onSubmitEditing={addPlayer}
              placeholder="ELO" placeholderTextColor={C.dim}
              keyboardType="number-pad"
              style={{ width: 70, color: C.text, backgroundColor: '#0f172a', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.line }}
            />
            <Pressable onPress={addPlayer} style={{ backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>+</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {state.players.map(p => (
              <Pressable key={p.id} onPress={() => toggleActive(p.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: p.active ? '#22c55e22' : '#0f172a',
                  borderColor: p.active ? '#22c55e66' : C.line,
                  borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6
                }}>
                <Text style={{ color: p.active ? '#4ade80' : C.dim, fontWeight: '600', fontSize: 13 }}>
                  {p.name} · {p.eloRating}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Start / courts */}
        {!state.tournamentStarted && activeCount >= 4 && (
          <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>Courts</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Pressable onPress={() => setCourts(c => Math.max(1, c - 1))} style={stepperBtn}><Text style={stepperTxt}>−</Text></Pressable>
                <Text style={{ color: C.green, fontSize: 22, fontWeight: '800', width: 30, textAlign: 'center' }}>{courts}</Text>
                <Pressable onPress={() => setCourts(c => Math.min(16, c + 1))} style={stepperBtn}><Text style={stepperTxt}>+</Text></Pressable>
              </View>
            </View>
            <Pressable onPress={startTournament} style={{ backgroundColor: C.blue, borderRadius: 10, padding: 14 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 16 }}>Start Tournament</Text>
            </Pressable>
          </View>
        )}

        {/* Rounds */}
        {state.tournamentStarted && (
          <>
            <Pressable onPress={generateRound} style={{ backgroundColor: C.greenDark, borderRadius: 10, padding: 14 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 16 }}>Generate Next Round</Text>
            </Pressable>
            {state.rounds.map((round, idx) => (
              <View key={round.id} style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 10 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>
                  Round {idx + 1}
                  {round.sittingOut ? <Text style={{ color: C.orange, fontSize: 13, fontWeight: '600' }}>   🪑 {round.sittingOut.name}</Text> : null}
                </Text>
                {round.matches.map(match => (
                  <MatchRow
                    key={match.id} match={match} pointsToWin={state.settings.pointsToWin}
                    winByTwo={state.settings.winByTwo ?? false} goldenPoint={state.settings.goldenPoint ?? false}
                    onScore={(team, delta) => scorePoint(round.id, match.id, team, delta)}
                    onOpen={() => setCourtMode({ roundId: round.id, matchId: match.id })}
                    onComplete={() => completeMatch(round.id, match.id)}
                  />
                ))}
              </View>
            ))}
            <Pressable onPress={() => undo()} style={{ padding: 10 }}>
              <Text style={{ color: C.dim, textAlign: 'center' }}>Undo last action</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const stepperBtn = { backgroundColor: '#334155', borderRadius: 8, width: 40, height: 40, alignItems: 'center' as const, justifyContent: 'center' as const };
const stepperTxt = { color: '#f1f5f9', fontSize: 22, fontWeight: '800' } as const;

function MatchRow({ match, pointsToWin, winByTwo, goldenPoint, onScore, onOpen, onComplete }: {
  match: Match; pointsToWin: number; winByTwo: boolean; goldenPoint: boolean;
  onScore: (team: 1 | 2, delta: 1 | -1) => void;
  onOpen: () => void; onComplete: () => void;
}) {
  const winner = !match.completed ? checkMatchWinner(match.score1, match.score2, pointsToWin, { winByTwo, goldenPoint }) : null;
  const serverName = resolveServerName(match.currentServer as ServerPos, match.pair1, match.pair2);
  return (
    <View style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontWeight: '600', flex: 1 }}>{match.pair1.players.map(p => p.name).join(' & ')}</Text>
        <Text style={{ color: winner === 1 ? C.green : C.text, fontSize: 30, fontWeight: '900', paddingHorizontal: 10 }}>{match.score1}</Text>
        <Text style={{ color: C.dim }}>:</Text>
        <Text style={{ color: winner === 2 ? C.green : C.text, fontSize: 30, fontWeight: '900', paddingHorizontal: 10 }}>{match.score2}</Text>
        <Text style={{ color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' }}>{match.pair2.players.map(p => p.name).join(' & ')}</Text>
      </View>
      {serverName && !match.completed && (
        <Text style={{ color: C.yellow, textAlign: 'center', fontWeight: '700', fontSize: 13 }}>🎾 {serverName}</Text>
      )}
      {!match.completed && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => onScore(1, 1)} style={{ flex: 1, backgroundColor: C.green, borderRadius: 8, padding: 10 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800' }}>+1 left</Text></Pressable>
          <Pressable onPress={() => onScore(2, 1)} style={{ flex: 1, backgroundColor: C.green, borderRadius: 8, padding: 10 }}><Text style={{ color: '#fff', textAlign: 'center', fontWeight: '800' }}>+1 right</Text></Pressable>
        </View>
      )}
      {!match.completed && (
        winner
          ? <Pressable onPress={onComplete} style={{ backgroundColor: C.yellow, borderRadius: 8, padding: 12 }}><Text style={{ color: '#0f172a', textAlign: 'center', fontWeight: '900' }}>🏆 CONFIRM WIN</Text></Pressable>
          : <Pressable onPress={onOpen} style={{ backgroundColor: C.cardSoft, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12 }}><Text style={{ color: C.text, textAlign: 'center', fontWeight: '700' }}>Court Mode</Text></Pressable>
      )}
    </View>
  );
}

function CourtMode({ match, pointsToWin, winByTwo, goldenPoint, onPoint, onComplete, onClose }: {
  match: Match; pointsToWin: number; winByTwo: boolean; goldenPoint: boolean;
  onPoint: (team: 1 | 2, delta: 1 | -1) => void;
  onComplete: () => void; onClose: () => void;
}) {
  const winner = checkMatchWinner(match.score1, match.score2, pointsToWin, { winByTwo, goldenPoint });
  const serverName = resolveServerName(match.currentServer as ServerPos, match.pair1, match.pair2);
  const t1 = match.pair1.players.map(p => p.name).join(' & ');
  const t2 = match.pair2.players.map(p => p.name).join(' & ');

  const half = (team: 1 | 2, name: string, score: number) => (
    <Pressable
      onPressIn={() => onPoint(team, 1)}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: winner === team ? C.yellow : C.dim, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
        {winner === team ? '🏆 ' : ''}{name}
      </Text>
      <Text style={{ color: team === 1 ? '#7dd3fc' : '#fdba74', fontSize: 130, fontWeight: '900' }}>{score}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar style="light" hidden />
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {half(1, t1, match.score1)}
        <View style={{ width: 1, backgroundColor: C.line }} />
        {half(2, t2, match.score2)}
      </View>
      {serverName && !match.completed && (
        <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: '#eab30822', borderColor: '#eab30866', borderWidth: 1, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ color: C.yellow, fontWeight: '800', fontSize: 18 }}>🎾 {serverName}</Text>
          </View>
        </View>
      )}
      <View style={{ position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.dim }}>first to {pointsToWin}</Text>
        <Pressable onPress={onClose}><Text style={{ color: C.text, fontWeight: '700' }}>✕ Exit</Text></Pressable>
      </View>
      {winner && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: '#022c22ee', alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1, alignSelf: 'stretch' }}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '900' }}>{winner === 1 ? t1 : t2} wins!</Text>
          <Text style={{ color: C.text, fontSize: 44, fontWeight: '900' }}>
            {winner === 1 ? `${match.score1}–${match.score2}` : `${match.score2}–${match.score1}`}
          </Text>
          <Pressable onPress={onComplete} style={{ backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>✓ Confirm & Save</Text>
          </Pressable>
          <Pressable onPress={onClose}><Text style={{ color: C.dim, padding: 10 }}>Keep playing</Text></Pressable>
        </View>
      )}
    </View>
  );
}

function Paywall({ access, onClose, onRefresh }: {
  access: AccessState | null; onClose: () => void; onRefresh: () => void;
}) {
  const trialEnd = access?.accessUntil;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <StatusBar style="light" />
      <Text style={{ fontSize: 56 }}>🎾</Text>
      <Text style={{ color: C.text, fontSize: 26, fontWeight: '900' }}>Tournament Day Pass</Text>
      <Text style={{ color: C.dim, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
        Run unlimited matches and tournaments for 24 hours.
        Your first 3 days are free — after that it's $0.99 per tournament day.
      </Text>
      {trialEnd && trialEnd > Date.now() && (
        <Text style={{ color: C.green, fontWeight: '700' }}>
          Access until {new Date(trialEnd).toLocaleString()}
        </Text>
      )}
      <Pressable
        onPress={() => {
          // Purchase flow lands with the RevenueCat key configured (see PADEL-APP.md).
          Alert.alert('Day Pass', 'Purchases activate once the RevenueCat key is configured in this build (see docs/PADEL-APP.md).');
        }}
        style={{ backgroundColor: C.greenDark, borderRadius: 12, paddingHorizontal: 40, paddingVertical: 16 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Buy Day Pass — $0.99</Text>
      </Pressable>
      <Pressable onPress={onRefresh}><Text style={{ color: C.dim }}>Check again</Text></Pressable>
      <Pressable onPress={onClose}><Text style={{ color: C.dim, marginTop: 8 }}>Close</Text></Pressable>
    </View>
  );
}
