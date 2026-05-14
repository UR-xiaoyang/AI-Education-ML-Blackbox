import { useEffect, useCallback } from 'react';

/**
 * 键盘快捷键 Hook
 * 
 * 支持的快捷键：
 * - ? - 显示/隐藏帮助
 * - 1-6 - 切换实验室
 * - ESC - 关闭弹窗
 * - T - 打开/关闭训练
 * - R - 重置
 * - G - 切换到 3D 视角（仅 NN 实验室）
 * - H - 隐藏/显示学习伴侣
 */
export default function useKeyboardShortcuts({
  onSwitchLab,      // 切换实验室 (labId: string)
  onToggleTrain,     // 切换训练
  onReset,          // 重置
  onToggle3D,       // 切换3D视角
  onToggleCompanion, // 切换学习伴侣
  onShowHelp,       // 显示帮助
  currentLab,       // 当前实验室
  disabled = false  // 是否禁用
}) {
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;
    
    // 如果用户正在输入框中，不触发快捷键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    // ? - 显示帮助
    if (key === '?' && !ctrl) {
      e.preventDefault();
      if (onShowHelp) onShowHelp();
      return;
    }

    // ESC - 关闭弹窗 (浏览器默认行为)
    if (key === 'escape') {
      // 这个由各个组件自己处理
      return;
    }

    // 1-6 - 切换实验室
    if (!ctrl && ['1', '2', '3', '4', '5', '6'].includes(key)) {
      e.preventDefault();
      const labMap = {
        '1': 'LINEAR',
        '2': 'LOGISTIC', 
        '3': 'TREE',
        '4': 'NN',
        '5': 'LLM',
        '6': 'YOLO'
      };
      if (onSwitchLab && labMap[key]) {
        onSwitchLab(labMap[key]);
      }
      return;
    }

    // T - 切换训练
    if (key === 't' && !ctrl) {
      e.preventDefault();
      if (onToggleTrain) onToggleTrain();
      return;
    }

    // R - 重置 (Ctrl+R 是刷新，所以用单独的 R)
    if (key === 'r' && !ctrl) {
      e.preventDefault();
      if (onReset) onReset();
      return;
    }

    // G - 切换3D视角
    if (key === 'g' && !ctrl) {
      e.preventDefault();
      if (currentLab === 'NN' && onToggle3D) {
        onToggle3D();
      }
      return;
    }

    // H - 隐藏/显示学习伴侣
    if (key === 'h' && !ctrl) {
      e.preventDefault();
      if (onToggleCompanion) onToggleCompanion();
      return;
    }

  }, [disabled, onSwitchLab, onToggleTrain, onReset, onToggle3D, onToggleCompanion, onShowHelp, currentLab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 快捷键帮助组件
 */
export function KeyboardShortcutsHelp({ isVisible, onClose }) {
  if (!isVisible) return null;

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 10010
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '20px',
        padding: '24px 32px',
        zIndex: 10011,
        minWidth: '320px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#fff', textAlign: 'center' }}>
          ⌨️ 键盘快捷键
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { key: '1-6', desc: '切换实验室' },
            { key: 'T', desc: '开始/停止训练' },
            { key: 'R', desc: '重置' },
            { key: 'G', desc: '3D视角 (仅NN实验室)' },
            { key: 'H', desc: '隐藏/显示学习伴侣' },
            { key: '?', desc: '显示此帮助' },
            { key: 'ESC', desc: '关闭弹窗' },
          ].map(({ key, desc }) => (
            <div key={key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{desc}</span>
              <kbd style={{
                background: 'rgba(99, 102, 241, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                color: '#fff'
              }}>
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '10px',
            background: 'rgba(99, 102, 241, 0.3)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '10px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          关闭
        </button>
      </div>
    </>
  );
}
