import React, { useState } from 'react';
import { usePedagogyStore } from '../store/pedagogyStore';
import './TutorialModal.css';

// 现在的 TutorialModal 主要用于响应剧本中的 requireReflection (简答反思) 步骤
export const TutorialModal = ({ onReflectionSubmit }) => {
  const isSimulationPaused = usePedagogyStore(state => state.isSimulationPaused);
  const spotlight = usePedagogyStore(state => state.spotlight);
  const resumeSimulation = usePedagogyStore(state => state.resumeSimulation);
  const addStudentAnswer = usePedagogyStore(state => state.addStudentAnswer);
  
  const [answer, setAnswer] = useState("");

  // 只有当暂停且当前步骤确实配置了反思题时，才渲染该全屏反思弹窗
  const isReflectionMode = spotlight.isActive && spotlight.reflectionConfig;
  
  if (!isSimulationPaused && !isReflectionMode) return null;

  const config = spotlight.reflectionConfig;
  const prompt = config ? config.questionText : spotlight.message;
  const minChars = config ? (config.minChars || 15) : 15;

  const handleSubmit = () => {
    if (answer.trim().length < minChars) {
      alert(`请更深入地描述你的思考（至少 ${minChars} 个字符）。这有助于你真正理解背后的原理！`);
      return;
    }

    addStudentAnswer({
      stage: 'SCENARIO_REFLECTION',
      question: prompt,
      answer: answer.trim(),
      timestamp: new Date().toISOString()
    });

    setAnswer("");
    resumeSimulation();
    
    // 通知剧本引擎，反思提交完毕，可以进入下一步
    if (onReflectionSubmit) {
      onReflectionSubmit();
    }
  };

  // 如果仅仅是普通的暂停（而非剧本里的 reflection 步骤），可以提供一个后备UI或不渲染
  if (!isReflectionMode) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10005 }}>
      <div className="modal-content glass-panel">
        <h2 className="modal-title text-gradient">现象反思 (Reflection)</h2>
        <p className="modal-prompt">{prompt}</p>
        
        <textarea
          className="modal-textarea"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={`请在此输入你的反思与推导（不要害怕答错，说出你的直觉，至少 ${minChars} 字）...`}
        />
        
        <button 
          className="btn btn-primary modal-submit"
          onClick={handleSubmit}
        >
          提交反思并继续
        </button>
      </div>
    </div>
  );
};
