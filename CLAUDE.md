# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"AI 通识教育：揭开机器学习的黑盒" — An interactive ML education platform for demystifying machine learning. Students learn ML concepts (linear/logistic regression, decision trees, neural networks, training faults) through guided experiments with step-by-step scenarios, spotlight overlays, and reflection questions.

**Frontend**: React 19 + Vite + Zustand (state management)
**Backend**: Express.js + SQLite/PostgreSQL (auth, session persistence)
**Ports**: Frontend 5173, Backend 3001

## Dev Commands

```bash
# Frontend (in ai-edu/)
npm run dev      # Vite dev server
npm run build    # Production build → dist/
npm run lint     # ESLint

# Backend (in ai-edu/backend/)
npm start        # Express server
npm run dev      # With nodemon auto-reload

# Build Scripts (project root)
../scripts/build.sh       # Interactive: dev mode, frontend only, backend only, production
../scripts/quick-build.bat # Windows quick frontend build
```

## Architecture

### App Entry Point
`src/App.jsx` delegates to `src/App.replacement.jsx` (the live app). `App.replacement.jsx` renders the full layout: experiment picker → tab navigation → lab rendering.

### Labs (`src/labs/`)
Self-contained interactive modules:
- `LinearRegressionLab.jsx` — gradient descent on MSE
- `LogisticRegressionLab.jsx` — binary classification with sigmoid + BCE
- `DecisionTreeLab.jsx` — tree engine for nonlinear classification
- `NeuralNetworkLab.jsx` — MLP with forward/backward pass
- `LLMLab.jsx` — LLM concepts (tokenization, attention, generation)
- `YOLOLab.jsx` — object detection/YOLO concepts
- `TeacherDashboardLab.jsx` — instructor analytics

### ML Engines (`src/utils/`)
Pure JS/TS, no React dependencies:
- `mlEngine.js` — linear regression (predict/MSE/gradient), logistic regression (sigmoid/BCE/gradient)
- `nnEngine.js` — MLP (Xavier init/predict/loss/trainStep with backprop); uses clipped ReLU
- `treeEngine.js` — decision tree implementation
- `dataGenerators.ts` — preset datasets (circle/xor/moons/poisoned)
- `miniLLMEngine.js` — lightweight LLM simulation for token/attention visualization

### Pedagogy System

**State**: `src/store/pedagogyStore.js` (Zustand) — tracks tutorial stage, spotlight config, interceptor rules, setup actions, unlocks, student answers.

**Scenario Config**: `src/store/scenarioConfig.ts` — defines guided experiments (Learning Rate Trap, Overfitting, Nonlinearity) as arrays of `ScenarioStep` objects with `TriggerCondition` (ON_CLICK, VALUE_CHANGE, AUTO_INTERCEPT, REFLECTION_SUBMIT, NEXT_BUTTON, COMPLETION_CHOICE).

**Scenario Engine**: `src/hooks/useScenarioEngine.replacement.ts` — drives guided mode. Listens to step triggers, sets spotlight/overlay state, pre-unlocks UI features, handles setup actions. The legacy wrapper `useScenarioEngine.ts` re-exports from the replacement.

**Interceptor**: `src/hooks/useTrainingInterceptor.js` — monitors epoch/loss during auto-training; auto-pauses and calls `nextStep()` when an `AUTO_INTERCEPT` rule matches.

**LLM Store**: `src/store/llmStore.js` — manages LLM lab state (training progress, generated text, attention matrices).

**Auth Store**: `src/store/authStore.js` — JWT-based authentication with persistence middleware.

### Components (`src/components/`)
- `SpotlightOverlay.jsx` + `.css` — dimming overlay with spotlight hole and guidance bubble
- `PedagogySidebar.jsx` — sidebar for guided pedagogy mode
- `FaultSimulatorUI.tsx` — UI for fault injection and training
- `NNFlowViz.jsx`, `NNNetworkViz.jsx`, `NNGraphCanvas.jsx`, `NNControlPanel.jsx` — NN visualization
- `LossChart.jsx` — real-time loss curve
- `DatasetPanel.jsx` — dataset selection and visualization
- `LLMViz/` — attention visualization, token embeddings, generation panel

### Backend API (`backend/`)
Express server with routes:
- `/api/auth/*` — login, register, token management
- `/api/pedagogy/*` — session summaries, student responses
- `/api/organizations/*` — class/group management

Database schema in `backend/schema.sql`: users, learning_sessions, student_responses, concept_confidence, organizations, token_blacklist.

## Key Patterns

### File Replacement Pattern
Several files intentionally replace existing ones with `.replacement` suffix:
```js
// src/hooks/useScenarioEngine.ts — wraps the replacement
export { useScenarioEngine } from './useScenarioEngine.replacement';

// src/App.jsx — delegates to the live replacement
import ReplacementApp from './App.replacement';
export default function App() { return <ReplacementApp />; }
```
**Edit the `.replacement.tsx` source**, not the re-export wrapper.

### CSS System
- `src/index.css` — Vite entry global styles
- `src/App.css` — app-level styles (36KB, contains most component styles)
- Shared classes: `.glass-panel` (frosted glass card), `.btn/.btn-primary` (buttons), `.text-gradient` (headings), `.nn-lab-*` (NN lab grid layout)

### State Architecture
- Stores: `src/store/` — Zustand (pedagogyStore, authStore, llmStore)
- Hooks: `src/hooks/` — named `use*.js` or `use*.jsx`
- ML logic: `src/utils/` — pure JS/TS, no React
- Labs: `src/labs/` — top-level page components

### Feature Gates
UI elements hidden by default, unlocked by scenario steps via `pedagogyStore.unlocks`. Components like NNControlPanel conditionally render: `{unlocks.showActivation && ...}`. See `scenarioConfig.ts` for unlock definitions.

### Poisoned Data
Preset `'poisoned'` in `NeuralNetworkLab.jsx` adds outliers (x=10, y=-5; x=-10, y=15) to trigger gradient explosion. Absence of normalization in `nnEngine.js` is by design — enables teaching gradient explosion.

### Training Loop
Auto-train runs 5 gradient steps per `requestAnimationFrame` tick, caps loss history to 150 points, ~16ms tick interval.
