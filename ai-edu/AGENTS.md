# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

"AI 通识教育：揭开机器学习的黑盒" — An interactive ML education platform. Students interactively learn ML concepts (linear/logistic regression, decision trees, neural networks, training faults) through guided experiments with step-by-step scenarios, spotlight overlays, and reflection questions.

**Frontend**: React 19 + Vite + Zustand (state management). Mix of JSX and TypeScript.
**Backend**: Express.js + PostgreSQL. Runs separately on port 3001.

## Dev Commands

```bash
# Frontend (root)
npm run dev      # Vite dev server (port 5173)
npm run build    # Production build → dist/
npm run lint     # ESLint

# Backend
cd backend && npm start        # Express server (port 3001)
cd backend && npm run dev      # With nodemon auto-reload
```

## Architecture

### App Entry Point
`src/App.jsx` currently returns `<ReplacementApp />` from `src/App.replacement.jsx`, which is the live app. `App.replacement.jsx` renders the full layout: experiment picker → tab navigation → lab rendering.

### Labs (`src/labs/`)
Each lab is a self-contained interactive module:
- `LinearRegressionLab.jsx` — gradient descent on MSE
- `LogisticRegressionLab.jsx` — binary classification with sigmoid + BCE
- `DecisionTreeLab.jsx` — tree engine for nonlinear classification
- `NeuralNetworkLab.jsx` — MLP with forward/backward pass; orchestrates graph canvas, flow viz, control panel, loss chart

### ML Engines (`src/utils/`)
- `mlEngine.js` — linear regression (predict/MSE/gradient), logistic regression (sigmoid/BCE/gradient)
- `nnEngine.js` — MLP (init/predict/loss/trainStep with backprop); supports linear or ReLU activation via `useRelu` flag
- `treeEngine.js` — decision tree implementation
- `dataGenerators.ts` — preset datasets (circle/xor/moons/poisoned)
- `faultyDataPresets.ts` — poisoned/outlier data for fault simulation

### Scenario/Pedagogy System

**State**: `src/store/pedagogyStore.js` (Zustand) — tracks tutorial stage, spotlight config, interceptor rules, setup actions, unlocked features, student answers.

**Scenario Config**: `src/store/scenarioConfig.ts` — defines 3 guided experiments (Learning Rate Trap, Overfitting, Nonlinearity) as arrays of `ScenarioStep` objects with `TriggerCondition` (ON_CLICK, VALUE_CHANGE, AUTO_INTERCEPT, REFLECTION_SUBMIT, NEXT_BUTTON).

**Scenario Engine**: `src/hooks/useScenarioEngine.replacement.ts` (active) — drives guided mode. Listens to step triggers, sets spotlight/overlay state, pre-unlocks UI features, handles setup actions. Exports `nextStep`, `reportValueChange`, `reportClick`.

**Legacy**: `src/hooks/useScenarioEngine.ts` — re-exports from `useScenarioEngine.replacement.ts` and exports the old implementation as `useScenarioEngineLegacy` (unused).

**Faulty Training Engine**: `src/hooks/useFaultyTrainingEngine.ts` — simulates training faults (gradient explosion, vanishing gradients, etc.) for the fault simulation lab mode.

### Training Interceptor
`src/hooks/useTrainingInterceptor.js` — monitors epoch count and loss during auto-training; auto-pauses simulation and calls `nextStep()` when an `AUTO_INTERCEPT` rule matches (e.g., loss explodes or epoch threshold reached).

### Components (`src/components/`)
Lab-specific and shared UI components. Key ones:
- `SpotlightOverlay.jsx` + `.css` — dimming overlay with a spotlight hole on the target element and a guidance bubble with "下一步" button. Controlled entirely by `pedagogyStore.spotlight` state.
- `NNFlowViz.jsx`, `NNNetworkViz.jsx` — forward-pass flow and network topology visualization for neural networks
- `NNGraphCanvas.jsx`, `NNControlPanel.jsx` — graph rendering and training controls
- `LossChart.jsx` — real-time loss curve plot
- `DatasetPanel.jsx` — dataset selection and visualization
- `ParameterSpaceViz.tsx` — hyperparameter landscape visualization
- `FaultSimulatorUI.tsx` — UI for injecting/training with simulated faults
- `TutorialModal.jsx` + `.css` — tutorial/dialog overlays
- Per-lab control/graph panels: `ControlPanel.jsx`, `GraphCanvas.jsx`, `LogisticControlPanel.jsx`, `LogisticGraphCanvas.jsx`, `TreeControlPanel.jsx`, `TreeGraphCanvas.jsx`

### Backend API
`backend/server.js` — Express server. Single endpoint:
- `POST /api/pedagogy/session-summary` — saves a completed experiment session (hyperparams, student reflection answers, concept confidences) to PostgreSQL using a transaction.

`backend/schema.sql` — PostgreSQL schema for `learning_sessions`, `student_responses`, `concept_confidence` tables.

## Key Patterns

### File Replacement Imports
Several components intentionally replace an existing file and re-export under the old name. The old file becomes a re-export layer:
```js
// src/hooks/useScenarioEngine.ts — wraps the replacement, exports legacy as deprecated alias
import { useScenarioEngine as _useScenarioEngine } from './useScenarioEngine.replacement';
export { useScenarioEngine } from './useScenarioEngine.replacement';
export const useScenarioEngineLegacy = _useScenarioEngine;

// src/App.jsx — currently delegates to the live replacement
import { ReplacementApp } from './App.replacement';
export default function App() { return <ReplacementApp />; }
```
When editing these, edit the `.replacement.tsx` source — not the re-export wrapper.

### CSS System
Global styles live in `src/index.css` (Vite entry). Component-level styles in `src/App.css`. Key shared classes:
- `.glass-panel` — frosted glass card used by NNControlPanel, LossChart, DatasetPanel, etc.
- `.btn` — base button style; `.btn-primary` gives accent color; `btn` inside `glass-panel` inherits panel contrast
- `.text-gradient` — gradient text for section headings
- `.nn-lab-*` — layout grid classes for the NeuralNetworkLab two-column layout

### State Architecture
- Zustand stores live in `src/store/` (`pedagogyStore.js`, `scenarioConfig.ts`)
- Hooks live in `src/hooks/` — named `use*.js` or `use*.jsx`
- ML logic lives in `src/utils/` — pure JS, no React dependencies
- Labs are in `src/labs/` — top-level page components that compose stores + hooks + ML engines

### Feature Gates
UI elements are hidden by default and unlocked by scenario steps via `pedagogyStore.unlocks`. Components like NNControlPanel conditionally render with `{unlocks.showActivation && ...}` blocks. See `src/store/scenarioConfig.ts` for the unlock definitions.

### Poisoned Data
Preset `'poisoned'` in `NeuralNetworkLab.jsx` adds extreme outliers (x=10, y=-5; x=-10, y=15) to trigger gradient explosion with large learning rates. This is intentional and the absence of data normalization in `nnEngine.js` is also by design.

### Training Loop
Auto-train loop runs 5 gradient steps per `requestAnimationFrame` tick and caps loss history to 150 points. Pause between ticks is ~16ms via `time - lastTime > 50` guard.
