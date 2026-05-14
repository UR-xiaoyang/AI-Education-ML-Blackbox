import React, { useMemo, useState } from 'react';
import LinearRegressionLab from './labs/LinearRegressionLab';
import LogisticRegressionLab from './labs/LogisticRegressionLab';
import DecisionTreeLab from './labs/DecisionTreeLab';
import NeuralNetworkLab from './labs/NeuralNetworkLab';
import { FaultSimulatorUI } from './components/FaultSimulatorUI';
import { TutorialModal } from './components/TutorialModal';
import { SpotlightOverlay } from './components/SpotlightOverlay';
import { useScenarioEngine } from './hooks/useScenarioEngine';
import { allScenarios } from './store/scenarioConfig';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserManagementPage } from './pages/UserManagementPage';
import ReplacementApp from './App.replacement';
import './index.css';
import './App.css';

function App() {
  // Use ReplacementApp for full functionality
  return <ReplacementApp />;
}

export default App;
