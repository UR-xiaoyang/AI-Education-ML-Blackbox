# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in the `ai-edu/` directory.

## Overview

Main application directory. For project-level context, architecture, and key patterns, see the root `CLAUDE.md`.

## Directory Structure

```
ai-edu/
├── src/
│   ├── labs/          # Interactive ML lab components
│   ├── components/    # Shared UI components
│   ├── hooks/         # Custom React hooks
│   ├── store/         # Zustand state stores
│   ├── utils/         # ML engines (pure JS/TS)
│   ├── pages/        # Auth and management pages
│   ├── App.jsx        # Entry point (delegates to App.replacement.jsx)
│   └── App.replacement.jsx  # Live app component
├── backend/           # Express.js API server
├── dist/              # Production build output
└── public/           # Static assets
```

## Dev Commands

```bash
# Frontend
npm run dev      # Vite dev server (port 5173)
npm run build    # Production build
npm run lint     # ESLint

# Backend
cd backend && npm start        # Express server (port 3001)
cd backend && npm run dev      # With nodemon
```

## Architecture

### Labs (`src/labs/`)
- `LinearRegressionLab.jsx` — gradient descent on MSE
- `LogisticRegressionLab.jsx` — sigmoid + BCE binary classification
- `DecisionTreeLab.jsx` — tree engine for nonlinear classification
- `NeuralNetworkLab.jsx` — MLP with forward/backward pass
- `LLMLab.jsx` — LLM concepts (tokenization, attention, generation)
- `YOLOLab.jsx` — object detection/YOLO concepts
- `TeacherDashboardLab.jsx` — instructor analytics

### ML Engines (`src/utils/`)
- `mlEngine.js` — linear/logistic regression
- `nnEngine.js` — MLP with backprop; clipped ReLU activation
- `treeEngine.js` — decision tree
- `dataGenerators.ts` — preset datasets (circle/xor/moons/poisoned)
- `miniLLMEngine.js` — lightweight LLM simulation

### Stores (`src/store/`)
- `pedagogyStore.js` — tutorial stage, spotlight, unlocks, student answers
- `scenarioConfig.ts` — guided experiment definitions
- `authStore.js` — JWT authentication
- `llmStore.js` — LLM lab state

### Key Patterns

**File Replacement**: `src/App.jsx` delegates to `src/App.replacement.jsx`. Edit the `.replacement` file.

**Feature Gates**: Components use `pedagogyStore.unlocks` to conditionally show UI elements.

**Poisoned Data**: The `'poisoned'` dataset intentionally omits normalization to demonstrate gradient explosion.
