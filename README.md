# Padel Indiano - Tournament Manager

A modern, feature-rich tournament management system for Padel Indiano with dynamic skill-based pairing.

## Features

### 🎯 Core Functionality
- **Dynamic Skill-Based Pairing**: Players are automatically paired each round based on their Points Per Game (PPG)
- **Smart Matching**: Algorithm ensures variety in partnerships and competitive matches
- **Automatic Round Generation**: New rounds auto-generate when all matches complete (configurable)
- **First-to-X Scoring**: Simple point-based scoring (default: first to 7 points wins)
- **Service Rotation**: Service rotates between teams and players each point

### 💾 Data Management
- **Auto-Save**: All tournament data automatically saved to localStorage
- **Undo/Redo**: Full history with undo/redo support (Ctrl+Z / Ctrl+Shift+Z)
- **Tournament Templates**: Save and load player groups for recurring tournaments
- **Export Options**: PDF, JSON, text reports, and web sharing

### ⌨️ Keyboard Shortcuts
- **Ctrl+Z**: Undo last action
- **Ctrl+Shift+Z** or **Ctrl+Y**: Redo
- **Ctrl+S**: Save as template
- **Q/A**: Adjust Team 1 score (+/-)
- **P/L**: Adjust Team 2 score (+/-)
- **Enter**: Complete match

### 📊 Advanced Features
- **Match History**: Complete log of all tournament actions
- **Player Statistics**: PPG, win rate, matches played, sit-out tracking
- **Edit Matches**: Modify completed matches with automatic stat recalculation
- **Leaderboard Modes**: Sort by Points Per Game or Total Points
- **Player Management**: Toggle players active/away status during tournament

### 🎨 Modern UI/UX
- **Responsive Design**: Optimized for mobile and desktop
- **Touch-Friendly**: Large touch targets for mobile devices
- **Toast Notifications**: Real-time feedback for all actions
- **Print Support**: Print-friendly leaderboards and brackets
- **PWA Ready**: Install as a progressive web app
- **Accessibility**: ARIA labels and keyboard navigation

### ⚙️ Configurable Settings
- **Points to Win**: Customizable (default 7, range 3-21)
- **Finals Format**: Traditional (1st+4th vs 2nd+3rd) or Semifinals
- **Auto-Generate Rounds**: Toggle automatic round creation

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

### Development

```bash
# Start dev server (opens automatically at http://localhost:3000)
npm run dev

# Run linter
npm run lint

# Run tests with UI
npm run test:ui
```

## How to Use

### 1. Add Players
- Enter player names in the input field
- Add at least 4 players to start the tournament

### 2. Configure Settings (Optional)
- Go to Settings tab to adjust tournament parameters
- **Points to Win**: Default is 7 (first team to 7 points wins)
- Settings are locked once the tournament starts

### 3. Start Tournament
- Click "Start Tournament" to begin
- First round generates automatically

### 4. Score Matches
- Use +/- buttons to adjust scores
- **First to X points wins** (e.g., first to 7)
- Service rotates between teams and players each point
- Click "Complete Match" when done
- Round auto-generates when all matches complete

### 5. Player Management
- Toggle players "away" if they need to take a break
- Away players are skipped in new rounds
- Toggle them back when they return

### 6. Finals
- Click "Initiate Finals" when ready
- Top 4 players: 1st+4th vs 2nd+3rd
- Same scoring format as regular matches (first to X points)
- Service rotates each point

### 7. Export & Share
- Export tournament data as PDF, JSON, or text report
- Share results via Web Share API (mobile)
- Save current setup as a template for future tournaments

## Architecture

### Tech Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications
- **jsPDF & html2canvas** for PDF export
- **Vitest** for testing

### Project Structure

```
src/
├── components/          # React components
│   ├── PlayerList.tsx
│   ├── Leaderboard.tsx
│   ├── MatchCard.tsx
│   ├── Settings.tsx
│   └── Toast.tsx
├── hooks/              # Custom React hooks
│   ├── useTournamentState.ts
│   └── useKeyboardShortcuts.ts
├── utils/              # Utility functions
│   ├── pairingAlgorithm.ts
│   ├── scoring.ts
│   ├── export.ts
│   └── localStorage.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── styles/             # Global styles
│   └── index.css
├── test/               # Test setup
│   └── setup.ts
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## Pairing Algorithm

The tournament uses an improved greedy pairing algorithm that:

1. **Sorts players by skill** (Points Per Game)
2. **Creates balanced pairs** prioritizing:
   - Partnership variety (prefer players who haven't played together)
   - Similar skill levels
3. **Matches pairs** based on:
   - Opposition variety (prefer players who haven't faced each other)
   - Similar combined team strength
4. **Manages sit-outs** fairly for odd player numbers

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an issue on GitHub.
