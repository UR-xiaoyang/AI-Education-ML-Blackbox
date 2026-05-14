import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAchievementById } from '../components/AchievementSystem';

/**
 * 成就状态管理
 */
const useAchievementStore = create(
  persist(
    (set, get) => ({
      // 状态
      xp: 0,
      achievements: [], // 已解锁的成就 ID 数组
      unlockedLabs: [], // 已完成的实验室
      totalLabsCompleted: 0,
      
      // 最新解锁的成就（用于显示动画）
      latestUnlock: null,
      
      // 添加 XP
      addXP: (amount) => {
        set(state => ({ xp: state.xp + amount }));
      },
      
      // 解锁成就
      unlockAchievement: (achievementId) => {
        const state = get();
        if (state.achievements.includes(achievementId)) {
          return false; // 已经解锁
        }
        
        const achievement = getAchievementById(achievementId);
        if (!achievement) return false;
        
        set(state => ({
          achievements: [...state.achievements, achievementId],
          xp: state.xp + achievement.xp,
          latestUnlock: achievement
        }));
        
        // 清除最新解锁状态（3秒后）
        setTimeout(() => {
          set({ latestUnlock: null });
        }, 3000);
        
        return true;
      },
      
      // 标记实验室完成
      completeLab: (labId) => {
        const state = get();
        if (state.unlockedLabs.includes(labId)) {
          return; // 已经完成
        }
        
        set(state => ({
          unlockedLabs: [...state.unlockedLabs, labId],
          totalLabsCompleted: state.totalLabsCompleted + 1
        }));
      },
      
      // 检查并解锁成就
      checkAndUnlock: (condition) => {
        const { achievements, xp } = get();
        
        // 根据条件解锁对应成就
        const checks = {
          // 线性回归
          'FIRST_POINT': achievements.length === 0,
          'FIRST_TRAIN': achievements.includes('FIRST_POINT'),
          'LINEAR_MASTER': achievements.includes('LOW_LOSS') && achievements.includes('INFERENCE_MODE'),
          'LOW_LOSS': true, // 由实验室调用时传入
          'INFERENCE_MODE': achievements.includes('FIRST_TRAIN'),
          
          // 神经网络
          'NN_EXPLORER': true,
          'CIRCLE_DATA': true,
          'XOR_CHALLENGE': true,
          'DEEP_LEARNING': true,
          'NN_LOW_LOSS': true,
          '3D_VIEW': true,
          
          // 逻辑回归
          'LOGISTIC_EXPLORER': true,
          'CLASSIFIER': true,
          
          // 综合
          'FIRST_LAB': true,
          'THREE_LABS': get().totalLabsCompleted >= 3,
          'FIVE_LABS': get().totalLabsCompleted >= 5,
          'XP_100': xp >= 100,
          'XP_500': xp >= 500,
          'LEVEL_5': xp >= 500, // 500 XP = level 5 (5*100)
        };
        
        if (checks[condition]) {
          return get().unlockAchievement(condition);
        }
        
        return false;
      },
      
      // 重置进度
      resetProgress: () => {
        set({
          xp: 0,
          achievements: [],
          unlockedLabs: [],
          totalLabsCompleted: 0,
          latestUnlock: null
        });
      }
    }),
    {
      name: 'ai-edu-achievements',
      version: 1
    }
  )
);

export default useAchievementStore;
