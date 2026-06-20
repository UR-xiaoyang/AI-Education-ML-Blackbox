/**
 * 实验剧本触发条件类型
 */
export enum TriggerCondition {
  ON_CLICK = 'ON_CLICK',               // 用户点击了高亮元素
  VALUE_CHANGE = 'VALUE_CHANGE',       // 用户修改了某个值(如拖动了滑块)
  AUTO_INTERCEPT = 'AUTO_INTERCEPT',   // 等待底层训练拦截器触发
  REFLECTION_SUBMIT = 'REFLECTION_SUBMIT', // 学生提交了反思简答题
  NEXT_BUTTON = 'NEXT_BUTTON',         // 用户点击了气泡上的"下一步"按钮(纯阅读引导)
  COMPLETION_CHOICE = 'COMPLETION_CHOICE' // 实验完成,学生选择进入下一章或自由探索
}

/**
 * 拦截器规则定义
 */
export interface InterceptorRule {
  monitor: 'loss' | 'epoch' | 'validationLoss';
  condition: '>' | '<' | '>=' | '<=' | '===' | 'isNaN' | 'plateau';
  threshold?: number;
}

/**
 * 选择题选项配置
 */
export interface QuizOption {
  text: string;        // 选项文本
  isCorrect?: boolean; // 是否为正确答案（用于自动判分）
}

/**
 * 简答题反思配置
 */
export interface ReflectionConfig {
  questionText: string;
  minChars?: number;           // 简答题才需要
  type?: 'text' | 'choice';   // 默认 'text'
  options?: QuizOption[];      // 选择题选项
  explanation?: string;       // 选择后的解释
}

/**
 * 剧本步骤定义
 */
export interface ScenarioStep {
  id: string;
  targetId?: string | null;           // 单个目标元素 ID(向后兼容)
  targetIds?: string[];               // 多个目标元素 ID 数组(用于双聚焦)
  guidanceText: string;               // 气泡提示文案
  triggerCondition: TriggerCondition; // 推进条件

  // 针对特定 triggerCondition 的附加配置
  targetValue?: any;                  // 当条件是 VALUE_CHANGE 时,期望达到的目标值
  targetValueOperator?: '==' | '>' | '<' | '>=' | '<='; // 值比较运算符,默认 ===
  interceptorRule?: InterceptorRule;  // 当条件是 AUTO_INTERCEPT 时,拦截器的触发规则
  requireReflection?: ReflectionConfig; // 是否需要强制简答反思

  // UI 副作用:进入该步骤时,是否解锁某些面板功能
  unlockFeatures?: string[];

  // 初始化副作用:进入该步骤时是否需要重置或预设环境状态(如:设定特定的数据集、禁用激活函数等)
  setupAction?: 'preset_data_moons' | 'preset_data_xor' | 'preset_data_poisoned' | 'disable_activation' | 'enable_activation';
}

/**
 * 完整实验定义
 */
export interface Experiment {
  id: string;
  title: string;
  description: string;
  setupAction?: 'LOAD_POISONED_DATA' | string; // 实验级别的初始化动作
  steps: ScenarioStep[];
}

// ============================================================================
// 神经网络实验室 - 渐进式学习课程
// ============================================================================

/**
 * 实验1:数据准备与第一次训练
 * 目标:让学生认识数据集和训练流程
 */
export const nnExperiments = [
  {
    id: 'NN_EXP_1_DATA_AND_TRAINING',
    title: '实验 1:数据与训练',
    description: '认识神经网络的基本组成:数据、网络、训练',
    steps: [
      {
        id: 'nn1_step_1_intro',
        targetId: 'nn-preset-buttons',
        guidanceText: '欢迎来到神经网络实验室!首先,让我们为AI准备"教材"。点击下方按钮,生成一组"同心圆"数据集--这是两个嵌套的圆环,代表两种类别。',
        triggerCondition: TriggerCondition.ON_CLICK,
        setupAction: 'preset_data_circle'
      },
      {
        id: 'nn1_step_2_observe_data',
        targetId: 'nn-graph-canvas',
        guidanceText: '观察画布上的数据点:橙色点为一类,蓝色点为另一类,它们交织在一起。神经网络的任务就是找到一条"分界线",把它们分开。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'nn1_step_3_first_train',
        targetId: 'btn-auto-train',
        guidanceText: '点击"深度学习"按钮,让AI开始学习!观察决策边界(背景色)如何从一片混乱逐渐变得清晰。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn1_step_4_observe_loss',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss(损失值)表示"AI犯了多少错"。数值越小越好。观察Loss曲线是否在下降?',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'nn1_step_5_reflection',
        guidanceText: '第一次训练完成!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '神经网络训练的本质是什么?Loss下降代表什么?',
          options: [
            { text: '让模型记住所有训练数据点', isCorrect: false },
            { text: '通过梯度下降调整参数，使 Loss 最小化', isCorrect: true },
            { text: '让神经元数量越来越多', isCorrect: false },
            { text: '减少训练数据的数量', isCorrect: false }
          ],
          explanation: '训练的本质是：模型通过计算预测值与真实值的误差(Loss)，然后利用梯度信息调整参数，逐步使 Loss 降低。Loss 下降说明模型在逐步学习到更好的规律。'
        }
      },
      {
        id: 'nn1_step_6_completion',
        guidanceText: '恭喜完成"数据与训练"章节!你已掌握神经网络的基本训练流程。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  /**
   * 实验2:学习率调参
   * 目标:理解学习率对训练的影响
   */
  {
    id: 'NN_EXP_2_LEARNING_RATE',
    title: '实验 2:学习率调参',
    description: '理解学习率对神经网络训练的影响',
    steps: [
      {
        id: 'nn2_step_1_intro',
        targetId: 'learning-rate-slider',
        guidanceText: '学习率(Learning Rate)决定了AI每一步"学习"的步伐大小。💡 把梯度下降想象成下山:学习率就是你每一步迈多远--步子太大可能越过山谷(震荡/爆炸),步子太小则下山太慢。系统已为你解锁学习率滑块。当前值是 0.5--一个比较安全的默认值。',
        triggerCondition: TriggerCondition.NEXT_BUTTON,
        unlockFeatures: ['showLearningRate']
      },
      {
        id: 'nn2_step_2_default_train',
        targetId: 'btn-auto-train',
        guidanceText: '先用默认学习率(0.5)训练一次,观察Loss曲线的变化。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn2_step_3_wait_converge',
        targetId: 'loss-chart-container',
        guidanceText: '观察Loss如何稳步下降...',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 60 }
      },
      {
        id: 'nn2_step_4_small_lr',
        targetId: 'learning-rate-slider',
        guidanceText: '现在,把学习率调小到 0.05(最小值)。仔细观察Loss曲线的变化速度--步伐变小了,下降变慢了,但更稳定。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.05,
        targetValueOperator: '<='
      },
      {
        id: 'nn2_step_5_train_small_lr',
        targetId: 'btn-auto-train',
        guidanceText: '再次点击训练,观察小学习率下的Loss曲线。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn2_step_6_big_lr',
        targetId: 'learning-rate-slider',
        guidanceText: '现在,把学习率调到最大 2.0。这是一种"激进"的学习策略--每一步迈得很大。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 2.0,
        targetValueOperator: '>='
      },
      {
        id: 'nn2_step_7_train_big_lr',
        targetId: 'btn-auto-train',
        guidanceText: '点击训练,观察会发生什么...',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn2_step_8_wait_explosion',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss在剧烈震荡,甚至可能爆炸到 NaN!这就是"梯度爆炸"--步子迈太大,参数失控了。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'isNaN' }
      },
      {
        id: 'nn2_step_9_reflection',
        guidanceText: '梯度爆炸!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '学习率过大为什么会导致训练失败?',
          options: [
            { text: '导致梯度消失，模型停止学习', isCorrect: false },
            { text: '每步更新过大，参数在最优解两侧来回跳跃甚至失控', isCorrect: true },
            { text: '模型容量不足，无法拟合数据', isCorrect: false },
            { text: '激活函数失效', isCorrect: false }
          ],
          explanation: '学习率过大时，每一步参数更新步长太大，导致参数在"最优解"两侧来回跳跃，最终失控(NaN)。想象从山顶下山，步子迈太大会跳过山谷，冲上山坡。'
        }
      },
      {
        id: 'nn2_step_10_completion',
        guidanceText: '恭喜完成"学习率调参"章节!你已理解学习率对训练稳定性的影响。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  /**
   * 实验3:网络容量探索
   * 目标:理解神经元数量对模型表达能力的影响
   */
  {
    id: 'NN_EXP_3_NETWORK_CAPACITY',
    title: '实验 3:网络容量',
    description: '探索神经元数量如何影响神经网络的表达能力',
    steps: [
      {
        id: 'nn3_step_1_intro',
        targetId: 'hidden-layers-slider',
        guidanceText: '神经元数量决定了神经网络的"脑容量"--能记住多少复杂的模式。系统已为你解锁神经元滑块。',
        triggerCondition: TriggerCondition.NEXT_BUTTON,
        unlockFeatures: ['showHiddenLayers']
      },
      {
        id: 'nn3_step_2_one_neuron',
        guidanceText: '当前网络只有 1 个神经元--这是最简单的大脑。💡 什么是神经元?把它想象成一个小计算器:它接收几个输入数字,分别乘以不同的"权重"后相加,最后通过一个"激活函数"输出一个结果。神经元数量越多,大脑的"思考单元"越多。让我们看看它的表现。'
      },
      {
        id: 'nn3_step_3_train_one',
        targetId: 'btn-auto-train',
        guidanceText: '点击训练,观察 1 个神经元能画出什么样的决策边界。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn3_step_4_observe_simple',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss 下降缓慢,且难以降到很低--因为单个神经元能力有限。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'epoch', condition: '>=', threshold: 100 }
      },
      {
        id: 'nn3_step_5_more_neurons',
        targetId: 'hidden-layers-slider',
        guidanceText: '把神经元数量增加到 8 个--这就像给大脑增加了更多的"思考单元"。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 8,
        targetValueOperator: '>='
      },
      {
        id: 'nn3_step_6_train_more',
        targetId: 'btn-auto-train',
        guidanceText: '点击训练,观察更多神经元能画出更复杂的边界。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn3_step_7_wait_fit',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss 下降得更快、更低了!更多的神经元提供了更强的"记忆力"。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: '<=', threshold: 0.15 }
      },
      {
        id: 'nn3_step_8_reflection',
        guidanceText: '更强的拟合能力!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '神经元数量越多，模型的"记忆"能力越强。但这种"强记忆"一定是好事吗？',
          options: [
            { text: '是的，神经元越多越好，记忆越精确', isCorrect: false },
            { text: '可能是坏事，过多的神经元可能导致过拟合', isCorrect: true },
            { text: '不是好事，会导致梯度消失', isCorrect: false },
            { text: '无所谓，神经元数量不影响模型性能', isCorrect: false }
          ],
          explanation: '过多的神经元会导致"过拟合"——模型在训练数据上表现很好，但在新数据上表现差。就像学生死记硬背所有题目，但遇到新题就不会做了。'
        }
      },
      {
        id: 'nn3_step_9_completion',
        guidanceText: '恭喜完成"网络容量"章节!你已理解神经元数量对模型表达能力的影响。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  /**
   * 实验4:激活函数与非线性
   * 目标:理解为什么需要激活函数
   */
  {
    id: 'NN_EXP_4_ACTIVATION_FUNCTION',
    title: '实验 4:激活函数',
    description: '理解激活函数如何让神经网络拥有非线性表达能力',
    steps: [
      {
        id: 'nn4_step_1_intro',
        targetId: 'nn-preset-buttons',
        guidanceText: '现在让我们面对真正的挑战--"异或(XOR)"数据集。这两组数据交叉在一起,任何直线都无法完美分开它们。💡 什么是 XOR?简单说就是:"两个输入相同则输出 0,不同则输出 1"--这种模式用一条直线永远分不开!点击生成异或数据!',
        triggerCondition: TriggerCondition.ON_CLICK,
        setupAction: 'disable_activation',
        unlockFeatures: ['showActivation']
      },
      {
        id: 'nn4_step_2_observe_xor',
        targetId: 'nn-graph-canvas',
        guidanceText: '观察画布:数据形成了一个对角线分布--左上、右下是蓝色,右上、左下是橙色。没有一条直线能把它们分开!',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'nn4_step_3_train_linear',
        targetId: 'btn-auto-train',
        guidanceText: '点击训练,观察神经网络在"禁用激活函数"状态下的挣扎--它只能画直线,永远切不开这个数据。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn4_step_4_wait_stuck',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss 停在一个较高的值,无法继续下降--这就是"欠拟合"。线性的神经元无法表达非线性的模式。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'epoch', condition: '>=', threshold: 100 }
      },
      {
        id: 'nn4_step_5_reflection_linear',
        guidanceText: '陷入僵局!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '为什么即使增加再多神经元，线性的神经网络也无法分开异或数据?',
          options: [
            { text: '因为神经元数量不够多', isCorrect: false },
            { text: '因为线性函数的叠加仍然是线性的，无法表达非线性模式', isCorrect: true },
            { text: '因为学习率设置不对', isCorrect: false },
            { text: '因为数据点太少', isCorrect: false }
          ],
          explanation: '线性函数的叠加仍然是线性的！无论多少层线性神经元，它们的组合效果等价于一个线性变换，无法表达非线性模式(如XOR)。激活函数正是为了给网络引入非线性。'
        }
      },
      {
        id: 'nn4_step_6_enable_relu',
        targetId: 'checkbox-relu',
        guidanceText: '现在,勾选开启"ReLU 激活函数"!这将为神经元注入"非线性"能力。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: true
      },
      {
        id: 'nn4_step_7_train_nonlinear',
        targetId: 'btn-auto-train',
        guidanceText: '再次点击训练,见证激活函数的神奇力量!',
        triggerCondition: TriggerCondition.ON_CLICK,
        setupAction: 'enable_activation'
      },
      {
        id: 'nn4_step_8_wait_success',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss 急剧下降!背景色开始形成复杂的曲线边界,成功将两类数据分开。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: '<=', threshold: 0.15 }
      },
      {
        id: 'nn4_step_9_reflection_nonlinear',
        guidanceText: '激活函数生效了!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '激活函数为什么重要?它让神经网络获得了什么能力?',
          options: [
            { text: '加快训练速度', isCorrect: false },
            { text: '让神经网络能够表达非线性模式', isCorrect: true },
            { text: '减少内存占用', isCorrect: false },
            { text: '防止梯度消失', isCorrect: false }
          ],
          explanation: '激活函数为神经网络引入了非线性！有了非线性，即使简单的3层网络也能表达任意复杂的模式。这就是为什么ReLU能让网络解决XOR问题——它打破了"线性叠加仍是线性"的限制。'
        }
      },
      {
        id: 'nn4_step_10_completion',
        guidanceText: '恭喜完成"激活函数"章节!你已理解非线性激活对于神经网络表达能力的重要性。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  /**
   * 实验5:过拟合与泛化
   * 目标:理解过拟合现象及其应对
   */
  {
    id: 'NN_EXP_5_OVERFITTING',
    title: '实验 5:过拟合与泛化',
    description: '探索过拟合现象,理解泛化能力的重要性',
    steps: [
      {
        id: 'nn5_step_1_intro',
        targetId: 'nn-preset-buttons',
        guidanceText: '让我们使用"双月牙"数据集--两组月牙形的数据相互交织,天然带有一些"噪音"。点击生成数据!',
        triggerCondition: TriggerCondition.ON_CLICK,
        setupAction: 'preset_data_moons'
      },
      {
        id: 'nn5_step_2_see_noise',
        targetId: 'nn-graph-canvas',
        guidanceText: '观察数据:两组月牙形数据之间有一些"间隙"和"重叠"区域--这就是噪音。真实数据往往都是这样的。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'nn5_step_3_big_network',
        targetId: 'hidden-layers-slider',
        guidanceText: '把神经元数量调到最大(16个),给AI超强的记忆能力!',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 16,
        unlockFeatures: ['showHiddenLayers']
      },
      {
        id: 'nn5_step_4_train_long',
        targetId: 'btn-auto-train',
        guidanceText: '点击训练,让AI训练非常久,我们要让它"死记硬背"每一个数据点。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn5_step_5_wait_overfit',
        targetId: 'loss-chart-container',
        guidanceText: 'Loss 越来越低,几乎为零--但这可能是"过度拟合"了!它在记住噪音,而不是学习真正的规律。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'epoch', condition: '>=', threshold: 500 }
      },
      {
        id: 'nn5_step_6_observe_boundary',
        targetId: 'nn-graph-canvas',
        guidanceText: '观察决策边界:为了完美拟合所有数据点(包括噪音),边界变得非常扭曲和不规则。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'nn5_step_7_switch_inference',
        targetId: 'nn-inference-mode-btn',
        guidanceText: '切换到"预测推理"模式,点击画布放置几个测试点,观察模型对新数据的预测。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn5_step_8_test_points',
        targetId: 'nn-graph-canvas',
        guidanceText: '在两组月牙的中间区域放置几个测试点,观察预测结果是否合理。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'nn5_step_9_reduce_capacity',
        targetId: 'hidden-layers-slider',
        guidanceText: '把神经元数量减少到 4,重新训练。这是一种"正则化"策略--限制模型的容量,防止过拟合。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 4,
        targetValueOperator: '<='
      },
      {
        id: 'nn5_step_10_train_regularized',
        targetId: 'btn-auto-train',
        guidanceText: '再次训练,观察更简洁的决策边界。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'nn5_step_11_reflection',
        guidanceText: '泛化能力!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '什么是过拟合?它和"死记硬背"有什么相似之处?',
          options: [
            { text: '模型在训练数据上表现差', isCorrect: false },
            { text: '模型在训练数据上表现很好，但新数据上表现差，像死记硬背一样', isCorrect: true },
            { text: '训练时间太长导致Loss不变', isCorrect: false },
            { text: '学习率设置过小', isCorrect: false }
          ],
          explanation: '过拟合就像学生死记硬背所有题目答案——在练习卷上得满分，但考试遇到新题就傻眼。模型记住了训练数据中的"噪音"，而不是真正的规律。'
        }
      },
      {
        id: 'nn5_step_12_completion',
        guidanceText: '恭喜完成"过拟合与泛化"章节!你已理解如何平衡模型容量和泛化能力。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 模块二:线性回归实验室引导实验
// ============================================================================

/**
 * 线性回归实验室引导实验
 */
export const linearRegressionScenarios: Experiment[] = [
  {
    id: 'LINEAR_BASICS',
    title: '线性回归基础',
    description: '从散点和拟合直线开始,理解损失函数与梯度下降。',
    steps: [
      {
        id: 'lr_step_1_add_points',
        targetId: 'lr-graph-canvas',
        guidanceText: '在左侧画布上点击,添加一些散点。这是模型要学习的"原材料"。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lr_step_2_train_one',
        targetId: 'lr-btn-train-step',
        guidanceText: '点击"单步 (Step)",执行一次梯度下降。看着右侧绿色的"梯度下降"区域--每次训练时,w 和 b 会沿着 Loss 下降最快的方向移动一小步。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'lr_step_3_observe_gradient',
        targetId: 'lr-gradient-descent-panel',
        guidanceText: '注意看:1 "梯度下降"面板里,∂Loss/∂w 和 ∂Loss/∂b 的值是多少?2 w 和 b 本步的变化量是多少?3 这两个梯度值分别告诉参数:应该往哪个方向、迈多大的一步?',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lr_step_3b_observe_loss',
        targetId: 'lr-loss-display',
        guidanceText: 'Loss(误差总和)代表所有红点到绿色直线的距离之和。梯度下降的目标就是让这条总距离越来越小。观察 Loss 值是否在下降?',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lr_step_4_lr_slider',
        targetId: 'lr-slider-learning-rate',
        guidanceText: '学习率(lr)控制每一步迈多远。拖动"学习步长"滑块,观察:lr 变小时,梯度值不变但每步变化量变小;lr 变大时,每步变化量变大(但过大则会震荡)。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.3,
        unlockFeatures: ['showLearningRate']
      },
      {
        id: 'lr_step_5_auto_train',
        targetId: 'lr-btn-auto-train',
        guidanceText: '点击"自动训练",让梯度下降算法持续迭代,观察直线逐步收敛。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'lr_step_6_wait_converge',
        guidanceText: '观察直线如何一步步拟合数据,Loss 值下降或趋于稳定后将自动进入下一步...',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 60 }
      },
      {
        id: 'lr_step_6b_observe_result',
        targetIds: ['lr-graph-canvas', 'lr-loss-display'],
        guidanceText: '训练完成!请仔细观察:1 绿色拟合直线是否穿过了大多数红点?2 右侧的 Loss 值是多少?3 w 和 b 的最终值是多少?思考一下:Loss 是什么,w 和 b 各自代表直线的什么属性?',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lr_step_7_switch_inference',
        targetId: 'lr-btn-mode-toggle',
        guidanceText: '切换到"预测推理"模式,测试模型的泛化能力。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'lr_step_7b_predict_points',
        targetId: 'lr-graph-canvas',
        guidanceText: '请在左侧画布上点击,放置几个测试点来验证模型的泛化能力。观察模型对这些未见过的点会给出什么样的预测值。完成后点击下方按钮继续。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lr_step_8_reflection',
        guidanceText: '线性回归掌握完毕!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '线性回归的核心是什么?Loss(均方误差)和梯度下降分别起什么作用?',
          options: [
            { text: '线性回归就是画一条穿过所有点的直线', isCorrect: false },
            { text: 'Loss衡量预测误差，梯度下降指导参数往误差更小的方向调整', isCorrect: true },
            { text: 'Loss决定学习率大小，梯度下降计算最终结果', isCorrect: false },
            { text: '线性回归不需要Loss，梯度下降自动找到最佳直线', isCorrect: false }
          ],
          explanation: '线性回归的核心是：Loss(均方误差)告诉我们"现在有多错"，梯度下降告诉我们"下一步应该往哪走"。两者配合，模型就能逐步从随机起点收敛到最优解。'
        }
      },
      {
        id: 'lr_step_9_completion',
        guidanceText: '恭喜完成线性回归章节!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 模块三:逻辑回归实验室引导实验
// ============================================================================

/**
 * 逻辑回归实验室引导实验
 */
export const logisticRegressionScenarios: Experiment[] = [
  {
    id: 'LOGISTIC_BASICS',
    title: '逻辑回归分类',
    description: '观察分类边界如何移动,理解二分类与交叉熵损失。',
    steps: [
      {
        id: 'lg_step_1_add_data',
        targetId: 'lg-graph-canvas',
        guidanceText: '左键点击添加橙色点(类别0),右键点击添加蓝色点(类别1)。将两类数据大致分开摆放。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lg_step_2_observe_boundary',
        targetId: 'lg-loss-display',
        guidanceText: '紫线是随机初始化的分类边界。橙蓝色点错在边界两侧会产生惩罚,Loss 值越大说明分错越多。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lg_step_3_train',
        targetId: 'lg-btn-auto-train',
        targetIds: ['lg-btn-auto-train'],
        guidanceText: '点击"自动训练",观察紫线如何旋转和平移,逐步将两类数据分开。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'lg_step_4_wait_fit',
        targetIds: ['lg-graph-canvas', 'lg-loss-display'],
        guidanceText: '仔细观察:左侧紫色的分类边界如何持续调整,右侧的 Loss 如何逐步下降...',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 60 }
      },
      {
        id: 'lg_step_4b_observe_result',
        targetIds: ['lg-graph-canvas', 'lg-loss-display'],
        guidanceText: '训练完成!请仔细观察:1 紫色分类边界是否将两类数据分开了?2 右侧的 Loss 值是多少?(Loss 越小说明分类越准确)思考一下:这条分类边界是如何"找到"的?',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lg_step_5_inference',
        targetId: 'lg-btn-mode-toggle',
        guidanceText: '切换到"预测推理"模式,点击画布放置测试点,观察模型如何判断未知点的类别。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'lg_step_5b_predict_points',
        targetId: 'lg-graph-canvas',
        guidanceText: '请在左侧画布上点击放置几个测试点,观察模型对这些未知点预测的类别(橙色或蓝色)。完成后点击下一步继续。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'lg_step_6_reflection',
        guidanceText: '逻辑回归掌握完毕!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '逻辑回归和线性回归的本质区别是什么?Sigmoid函数在其中起了什么作用?',
          options: [
            { text: '逻辑回归可以处理多个类别', isCorrect: false },
            { text: '逻辑回归输出概率，Sigmoid将连续值映射到0-1之间', isCorrect: true },
            { text: '逻辑回归使用不同的损失函数', isCorrect: false },
            { text: '逻辑回归需要更多训练数据', isCorrect: false }
          ],
          explanation: 'Sigmoid函数就像一个"分类开关"，将线性组合的结果(-∞到+∞)映射到(0,1)区间。输出值可以解释为"属于类别1的概率"，概率大于0.5就预测为正类，否则为负类。'
        }
      },
      {
        id: 'lg_step_7_completion',
        guidanceText: '恭喜完成逻辑回归章节!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 模块四:决策树实验室引导实验
// ============================================================================

/**
 * 决策树实验室引导实验
 */
export const decisionTreeScenarios: Experiment[] = [
  {
    id: 'TREE_BASICS',
    title: '决策树与空间切分',
    description: '通过空间切分理解模型容量与泛化能力。',
    steps: [
      {
        id: 'dt_step_1_add_data',
        targetId: 'dt-graph-canvas',
        guidanceText: '左键添加橙色阵营,右键添加蓝色阵营,将两类数据穿插摆放(不要太整齐)。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'dt_step_2_one_cut',
        targetIds: ['dt-graph-canvas', 'dt-actual-depth'],
        guidanceText: '当前树深度限制为1层(只能砍一刀)。观察这条切线是如何尽力分开两类数据的--它只能横切或竖切,效果有限。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'dt_step_3_overfit',
        targetIds: ['dt-graph-canvas', 'dt-slider-max-depth'],
        guidanceText: '只有一刀似乎分不干净?现在,请将滑块拉到最大!看看那些为了迎合单个孤立点而切出来的\'小方块\',模型是不是在\'死记硬背\'?',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 5,
        targetValueOperator: '>='
      },
      {
        id: 'dt_step_4_inference_mode',
        targetIds: ['dt-btn-mode-inference'],
        guidanceText: '死记硬背的模型能考高分吗?让我们进入【预测推理】模式。点击左上角的"推理模式"按钮。',
        triggerCondition: TriggerCondition.ON_CLICK,
        targetId: 'dt-btn-mode-inference'
      },
      {
        id: 'dt_step_5_inference_click',
        targetIds: ['dt-graph-canvas'],
        guidanceText: '现在,请在画布上点击放置一个测试点,观察模型如何对未见过的数据进行预测。',
        triggerCondition: TriggerCondition.ON_CLICK,
        targetId: 'dt-graph-canvas'
      },
      {
        id: 'dt_step_6_prune',
        targetIds: ['dt-graph-canvas', 'dt-slider-max-depth'],
        guidanceText: '为了不让模型死记硬背,我们需要限制它的容量。现在,把深度滑块退回到 2 看看。恭喜你掌握了\'剪枝\'的奥秘!',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetId: 'dt-slider-max-depth',
        targetValue: 2,
        targetValueOperator: '<='
      },
      {
        id: 'dt_step_7_reflection',
        guidanceText: '决策树掌握完毕!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '为什么决策树深度过大会导致过拟合?它和线性模型过拟合的表现有什么不同?',
          options: [
            { text: '决策树太深会导致梯度消失', isCorrect: false },
            { text: '决策树太深会记住每个训练样本的细节，包括噪音，表现为不规则的切分边界', isCorrect: true },
            { text: '决策树太深会让训练变慢', isCorrect: false },
            { text: '决策树深度不影响过拟合', isCorrect: false }
          ],
          explanation: '决策树通过不断切分特征空间来分类。深度太大时，树会为少数几个样本甚至单个异常点创造专门的分支。这就像为每个学生量身定做考试题——无法应对新问题。过拟合的决策树边界往往是不规则的小方块。'
        }
      },
      {
        id: 'dt_step_8_completion',
        guidanceText: '恭喜完成决策树章节!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 模块五:故障实验台引导实验(异常情况专题)
// ============================================================================

/**
 * 故障实验台引导实验 - 专门讲解训练过程中的异常情况
 */
export const faultScenarios: Experiment[] = [
  {
    id: 'FAULT_DIAGNOSIS',
    title: '故障诊断实验台',
    description: '深入了解神经网络训练中的常见故障与解决方案',
    steps: [
      {
        id: 'f_step_1_intro',
        targetId: 'fault-simulator',
        guidanceText: '欢迎来到故障诊断实验台!这里是AI训练中的"急诊室",我们将逐一观察和诊断常见的训练故障。观察左侧的三栏布局:可视化画布、状态信息、控制面板。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_2_select_baseline',
        targetId: 'fault-dataset-select',
        guidanceText: '首先,选择"标准数据"作为基准。这是一组线性分布的数据,我们将用它来观察正常训练过程。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 'standard'
      },
      {
        id: 'f_step_3_set_params',
        targetId: 'fault-hidden-nodes-slider',
        guidanceText: '将隐藏层节点数设置为 8,学习率保持默认的 0.5。这是比较安全的参数配置。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 8,
        targetValueOperator: '>='
      },
      {
        id: 'f_step_4_normal_training',
        targetId: 'fault-btn-train',
        guidanceText: '点击"开始训练",观察正常训练过程:Loss 稳步下降,拟合曲线逐渐贴合数据点。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'f_step_5_observe_normal',
        targetId: 'fault-loss-chart-container',
        guidanceText: '观察 Loss 曲线如何平稳下降,状态区域显示"🔄 训练中"。这就是我们期望的"健康训练"状态。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 60 }
      },
      {
        id: 'f_step_6_fault_1_intro',
        guidanceText: '🔴 故障一:梯度爆炸\n\n现在让我们人为制造故障,观察其表现。首先是"梯度爆炸"--这是最常见的训练崩溃原因。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_7_fault_1_demo',
        targetId: 'fault-lr-slider',
        guidanceText: '将学习率调大到 2.0(拖动到最右侧)。过大的学习率会导致每一步更新过大,参数失控。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 2.0,
        targetValueOperator: '>='
      },
      {
        id: 'f_step_8_fault_1_train',
        targetId: 'fault-btn-train',
        guidanceText: '点击训练,观察会发生什么...Loss 曲线会突然爆炸到 NaN。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'f_step_9_fault_1_observe',
        targetId: 'fault-loss-chart-container',
        guidanceText: 'Loss 爆炸到 NaN!画布上显示红色警告。这就是梯度爆炸--参数更新步长过大,导致数值溢出。观察状态区域的"⚠️ 检测到故障"提示。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'isNaN' }
      },
      {
        id: 'f_step_10_fault_1_solution',
        guidanceText: '💡 解决方案:\n1. 降低学习率(推荐 0.01-0.1)\n2. 启用梯度裁剪(防止梯度过大)\n3. 使用自适应优化器(Adam、RMSprop)\n4. 合理的权重初始化',
        triggerCondition: TriggerCondition.NEXT_BUTTON,
        unlockFeatures: ['showGradientClipping']
      },
      {
        id: 'f_step_11_fault_2_intro',
        guidanceText: '🟠 故障二:梯度消失\n\n现在让我们观察另一个极端--梯度消失。这会导致模型几乎停止学习。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_12_reset_for_vanish',
        targetId: 'fault-btn-reset',
        guidanceText: '首先点击"重置"按钮,清除之前的训练状态。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'f_step_13_fault_2_demo',
        targetId: 'fault-lr-slider',
        guidanceText: '将学习率调小到 0.001(拖动到最左侧)。极小的学习率会导致每一步更新太小,模型几乎停止学习。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.001,
        targetValueOperator: '<='
      },
      {
        id: 'f_step_14_fault_2_train',
        targetId: 'fault-btn-train',
        guidanceText: '点击训练,观察 Loss 曲线的变化--它几乎保持不变,下降速度极慢。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'f_step_15_fault_2_observe',
        targetId: 'fault-loss-chart-container',
        guidanceText: 'Loss 几乎不变,下降速度极慢(观察 Loss 曲线是否平缓)!这就是梯度消失--每一步更新太小,模型几乎停止学习。状态区域显示"⚠️ 梯度消失"。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'f_step_16_fault_2_solution',
        guidanceText: '💡 解决方案:\n1. 提高学习率(但不要过高)\n2. 使用 ReLU 激活函数(比 Sigmoid 更不易梯度消失)\n3. 合理的权重初始化(Xavier/He)\n4. 使用残差连接(ResNet)\n5. 学习率调度器(随训练动态调整)',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_17_fault_3_intro',
        guidanceText: '🟡 故障三:过拟合\n\n现在让我们观察过拟合现象--模型在训练数据上表现很好,但泛化能力差。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_18_select_noisy',
        targetId: 'fault-dataset-select',
        guidanceText: '切换到"噪音数据"--这组数据带有更大的噪音,更容易暴露过拟合问题。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 'noisy'
      },
      {
        id: 'f_step_19_fault_3_setup',
        targetId: 'fault-hidden-nodes-slider',
        guidanceText: '将神经元数量调到最大(20),增加模型容量。大模型更容易过拟合。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 20,
        targetValueOperator: '>='
      },
      {
        id: 'f_step_20_set_lr_normal',
        targetId: 'fault-lr-slider',
        guidanceText: '将学习率调回正常值(0.5 左右)。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.5
      },
      {
        id: 'f_step_21_set_epochs_high',
        targetId: 'fault-epochs-slider',
        guidanceText: '将训练轮数设置为 1500,让模型训练很长时间。长时间训练 + 大模型 = 过拟合。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 1500,
        targetValueOperator: '>='
      },
      {
        id: 'f_step_22_fault_3_train',
        targetId: 'fault-btn-train',
        guidanceText: '点击训练,观察 Loss 曲线下降到几乎为零--这看起来很好,但实际上可能是过拟合!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'f_step_23_fault_3_observe',
        targetId: 'fault-loss-chart-container',
        guidanceText: 'Loss 降到极低(接近 0)!但这可能是"死记硬背"--模型在记住每一个数据点(包括噪音),而不是学习真正的规律。观察状态区域显示"⚠️ 检测到故障"。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'epoch', condition: '>=', threshold: 1000 }
      },
      {
        id: 'f_step_24_fault_3_solution',
        guidanceText: '💡 解决方案:\n1. 增加训练数据量\n2. 使用正则化(L1/L2 惩罚)\n3. 使用 Dropout(随机丢弃神经元)\n4. 早停(Early Stopping)\n5. 降低模型容量(减少神经元数量)\n6. 数据增强',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_25_fault_4_intro',
        guidanceText: '🟣 故障四:数据污染\n\n最后,让我们观察数据污染问题--当训练数据包含极端离群点时,模型会被扭曲。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_26_select_poisoned',
        targetId: 'fault-dataset-select',
        guidanceText: '选择"污染数据"--这组数据包含多个极端离群点(如 x=90, y=-500)。观察画布上显示的红色"离群点"标记。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 'poisoned'
      },
      {
        id: 'f_step_27_fault_4_setup',
        targetId: 'fault-hidden-nodes-slider',
        guidanceText: '将神经元数量设置为 8,避免模型过度拟合极端值。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 8
      },
      {
        id: 'f_step_28_fault_4_train',
        targetId: 'fault-btn-train',
        guidanceText: '点击训练,观察模型如何被极端离群点影响--拟合曲线会试图穿过那些极端点,导致整体拟合变差。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'f_step_29_fault_4_observe',
        guidanceText: '观察画布:为了拟合那个极端的离群点(90, -500),拟合曲线被严重扭曲。模型在"迎合"那些错误的数据点,而不是学习真实规律。这就是数据污染的危害!',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_30_fault_4_solution',
        guidanceText: '💡 解决方案:\n1. 数据清洗(检测并移除离群点)\n2. 使用鲁棒的损失函数(如 Huber Loss)\n3. 异常检测预处理\n4. 数据标准化/归一化\n5. 特征工程(识别并处理异常)',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_31_summary',
        guidanceText: '📋 故障诊断总结\n\n我们已经学习了四种常见的训练故障:\n\n🔴 梯度爆炸:参数更新失控 → 降低学习率、梯度裁剪\n🟠 梯度消失:学习停滞 → ReLU、合适初始化\n🟡 过拟合:泛化差 → 正则化、早停、减少容量\n🟣 数据污染:被极端值扭曲 → 数据清洗、鲁棒损失',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'f_step_32_reflection',
        guidanceText: '故障诊断掌握完毕!',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '以下哪种情况最可能是"梯度爆炸"?',
          options: [
            { text: 'Loss几乎不变，训练停滞', isCorrect: false },
            { text: 'Loss突然变成NaN或极大值，训练崩溃', isCorrect: true },
            { text: '训练Loss低但测试Loss高', isCorrect: false },
            { text: '预测结果全错', isCorrect: false }
          ],
          explanation: '梯度爆炸的特征是Loss突然飙升到NaN或极大值，表示参数更新失控。过大的学习率导致每一步更新步长过大，参数在最优解两侧来回跳跃最终失控。'
        }
      },
      {
        id: 'f_step_33_completion',
        guidanceText: '恭喜完成"故障诊断"章节!你已掌握神经网络训练中的常见故障及其解决方案。现在你可以自由探索,尝试不同的参数组合来观察各种故障现象。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 故障实验台 - 四个独立实验(新结构)
// ============================================================================

/**
 * 故障实验台 - 四个独立实验
 * 每个实验都可以独立开始,学生可以任选一个
 */
export const faultExperiments: Experiment[] = [
  // ============================================================================
  // 实验1:梯度爆炸
  // ============================================================================
  {
    id: 'FAULT_EXP_1_GRADIENT_EXPLOSION',
    title: '实验1:梯度爆炸',
    description: '学习率过大导致的训练崩溃,学会识别和修复',
    steps: [
      {
        id: 'exp1_step1_intro',
        targetId: 'fault-simulator',
        guidanceText: '🔴 梯度爆炸实验\n\n欢迎来到第一个故障实验!\n\n【故障简介】\n梯度爆炸是指训练过程中参数更新步长过大,导致Loss突然飙升到无穷大(NaN),训练彻底崩溃。\n\n【制造方法】\n将学习率设置得很大(如2.0),配合大权重初始化。\n\n【体验目标】\n1. 观察Loss从正常到爆炸的过程\n2. 理解为什么会爆炸\n3. 学习如何修复',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp1_step2_normal',
        targetId: 'fault-btn-train',
        guidanceText: '首先,让我们观察正常训练。\n\n1. 数据集:标准数据\n2. 学习率:0.1\n3. 神经元:8个\n\n点击【开始训练】,观察正常情况下Loss稳步下降的过程。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp1_step3_wait_normal',
        targetId: 'fault-loss-chart-container',
        guidanceText: '观察Loss曲线:\n- Loss从高值开始\n- 逐渐稳定下降\n- 曲线平滑\n\n这就是正常的训练过程。当Loss稳定下降后,系统将自动进入下一步。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'exp1_step4_create_fault',
        guidanceText: '现在让我们制造故障!\n\n🔧 请按以下步骤操作:\n1. 点击【重置】清除之前的训练\n2. 将学习率调到最大(2.0)\n3. 将权重初始化改为"大权重 (易爆炸)"\n\n准备好了吗?',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp1_step5_train_fault',
        targetId: 'fault-btn-train',
        guidanceText: '现在点击【开始训练】,观察梯度爆炸的发生!\n\n你会看到Loss急剧上升,然后变成NaN或Inf。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp1_step6_observe_explosion',
        targetId: 'fault-loss-chart-container',
        guidanceText: '⚠️ 梯度爆炸发生了!\n\n观察发生了什么:\n- Loss突然飙升\n- 数值变成NaN或极大值\n- 状态区域显示红色警告\n- 训练崩溃\n\n这就是梯度爆炸 -- 参数更新步长失控!',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'isNaN' }
      },
      {
        id: 'exp1_step7_diagnosis',
        guidanceText: '🔍 故障诊断\n\n【为什么会爆炸?】\n想象一下:你从山顶下山,每一步应该迈0.5米。但如果每一步迈10米会怎样?\n- 你会跳过谷底\n- 你会冲上山坡\n- 越走越乱,最终迷失方向\n\n神经网络训练也是一样:\n- 学习率太大 → 每步更新太大\n- 参数在"最优解"两侧来回跳跃\n- 最终失控(NaN)\n\n【解决方案】\n1. 降低学习率(从2.0降到0.01)\n2. 启用梯度裁剪(限制最大更新步长)\n3. 使用合理的初始化(Xavier/He)',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp1_step8_apply_fix',
        targetId: 'fault-btn-apply-fix',
        guidanceText: '💡 现在让我们修复这个问题!\n\n系统检测到梯度爆炸,已为你准备好修复方案:\n\n🔧 推荐修复:\n- 学习率:2.0 → 0.01(降低99.5%)\n- 梯度裁剪:✗ → ✓(启用)\n- 初始化:大权重 → Xavier\n\n点击【应用修复方案】按钮,应用这些修复!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp1_step9_verify_fix',
        targetId: 'fault-btn-train',
        guidanceText: '修复已应用!现在参数已调整为安全值。\n\n点击【开始训练】验证修复效果!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp1_step10_observe_healthy',
        targetId: 'fault-loss-chart-container',
        guidanceText: '✅ 修复成功!\n\n观察现在的训练:\n- Loss平稳下降\n- 没有爆炸\n- 曲线平滑\n\n对比一下修复前后的差异:\n| 指标 | 修复前 | 修复后 |\n|------|--------|--------|\n| 学习率 | 2.0 | 0.01 |\n| 梯度裁剪 | ✗ | ✓ |\n| 状态 | 爆炸 | 正常 |',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'exp1_step11_summary',
        guidanceText: '📋 实验总结\n\n【梯度爆炸】\n🔴 症状:Loss突然变成NaN或极大值\n🧠 原因:学习率过大,参数更新失控\n💊 药方:\n  - 降低学习率\n  - 启用梯度裁剪\n  - 合理初始化\n\n恭喜完成【梯度爆炸】实验!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  // ============================================================================
  // 实验2:梯度消失
  // ============================================================================
  {
    id: 'FAULT_EXP_2_GRADIENT_VANISHING',
    title: '实验2:梯度消失',
    description: '学习率过小导致的训练停滞,学会识别和修复',
    steps: [
      {
        id: 'exp2_step1_intro',
        targetId: 'fault-simulator',
        guidanceText: '🟠 梯度消失实验\n\n欢迎来到第二个故障实验!\n\n【故障简介】\n梯度消失是指训练过程中梯度值变得极小,导致参数几乎不更新,模型停止学习。\n\n【制造方法】\n将学习率设置得极小(如0.001),配合Sigmoid激活函数。\n\n【体验目标】\n1. 观察Loss几乎不变的过程\n2. 理解为什么会消失\n3. 学习如何修复',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp2_step2_normal',
        targetId: 'fault-btn-train',
        guidanceText: '首先,让我们观察正常训练。\n\n1. 数据集:标准数据\n2. 学习率:0.1\n3. 激活函数:ReLU(推荐)\n4. 神经元:8个\n\n点击【开始训练】,观察正常训练。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp2_step3_wait_normal',
        targetId: 'fault-loss-chart-container',
        guidanceText: '正常训练进行中...\n\nLoss在稳步下降,说明模型在学习。\n\n当Loss稳定下降后,系统将自动进入下一步。',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'exp2_step4_create_fault',
        guidanceText: '现在让我们制造梯度消失故障!\n\n🔧 请按以下步骤操作:\n1. 点击【重置】\n2. 将学习率调到最小(0.001)\n3. 将激活函数改为"Sigmoid (易梯度消失)"\n\n这会制造一个"几乎停止学习"的状态。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp2_step5_train_fault',
        targetId: 'fault-btn-train',
        guidanceText: '点击【开始训练】,观察梯度消失!\n\n注意观察Loss曲线的变化速度...',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp2_step6_observe_vanish',
        targetId: 'fault-loss-chart-container',
        guidanceText: '⚠️ 梯度消失发生了!\n\n观察发生了什么:\n- Loss下降极慢\n- 曲线几乎水平\n- 模型几乎停止学习\n\n这就是梯度消失 -- 每一步更新太小,模型"凝固"了!',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'epoch', condition: '>=', threshold: 100 }
      },
      {
        id: 'exp2_step7_diagnosis',
        guidanceText: '🔍 故障诊断\n\n【为什么会消失?】\n想象一下:你从山顶下山,但每一步只能迈0.001米。\n- 每一步太微小\n- 要走10万步才能下山\n- 实际上走不了那么远\n\n神经网络也是一样:\n- 学习率太小 → 每步更新太小\n- Sigmoid函数在两端梯度接近0\n- 参数几乎不更新\n\n【解决方案】\n1. 提高学习率(从0.001升到0.1)\n2. 使用ReLU激活函数(梯度恒为1或0,不会消失)\n3. 使用He初始化',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp2_step8_apply_fix',
        targetId: 'fault-btn-apply-fix',
        guidanceText: '💡 现在修复这个问题!\n\n🔧 推荐修复:\n- 学习率:0.001 → 0.1(提高100倍)\n- 激活函数:Sigmoid → ReLU\n\n点击【应用修复方案】按钮!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp2_step9_verify_fix',
        targetId: 'fault-btn-train',
        guidanceText: '修复已应用!现在点击【开始训练】验证效果!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp2_step10_observe_healthy',
        targetId: 'fault-loss-chart-container',
        guidanceText: '✅ 修复成功!\n\n观察现在的训练:\n- Loss明显下降\n- 训练速度恢复正常\n- 模型在学习\n\n对比:\n| 指标 | 修复前 | 修复后 |\n|------|--------|--------|\n| 学习率 | 0.001 | 0.1 |\n| 激活函数 | Sigmoid | ReLU |\n| 状态 | 消失 | 正常 |',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'exp2_step11_summary',
        guidanceText: '📋 实验总结\n\n【梯度消失】\n🟠 症状:Loss几乎不变,下降极慢\n🧠 原因:学习率太小 + Sigmoid梯度消失\n💊 药方:\n  - 提高学习率\n  - 使用ReLU激活\n  - 合理初始化\n\n恭喜完成【梯度消失】实验!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  // ============================================================================
  // 实验3:过拟合
  // ============================================================================
  {
    id: 'FAULT_EXP_3_OVERFITTING',
    title: '实验3:过拟合',
    description: '模型过于复杂导致的泛化能力差,学会识别和修复',
    steps: [
      {
        id: 'exp3_step1_intro',
        targetId: 'fault-simulator',
        guidanceText: '🟡 过拟合实验\n\n欢迎来到第三个故障实验!\n\n【故障简介】\n过拟合是指模型在训练数据上表现很好,但在新数据上表现差 -- 像一个"死记硬背"的学生。\n\n【制造方法】\n使用噪音数据 + 大模型 + 长时间训练\n\n【体验目标】\n1. 观察训练Loss下降但验证Loss上升\n2. 理解什么是泛化能力\n3. 学习如何防止过拟合',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp3_step2_setup',
        targetId: 'fault-dataset-select',
        guidanceText: '🔧 请按以下步骤设置:\n1. 选择"噪音数据"-- 这组数据带有噪音\n2. 神经元数量调到最大(20)\n3. 训练轮数设为1500\n\n这样设置是为了让模型"死记硬背"每个数据点。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 'noisy'
      },
      {
        id: 'exp3_step3_train',
        targetId: 'fault-btn-train',
        guidanceText: '点击【开始训练】,让模型训练很长时间...\n\n我们会训练1500轮,让模型充分"记忆"每一个数据点(包括噪音)。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp3_step4_observe_overfit',
        targetId: 'fault-loss-chart-container',
        guidanceText: '⚠️ 过拟合发生了!\n\n观察图表中的两条曲线:\n\n📈 训练Loss(蓝线):持续下降,接近0\n📉 验证Loss(紫虚线):开始上升!\n\n这就是过拟合!\n\n训练Loss很低 → 模型记住了训练数据\n验证Loss上升 → 模型在新数据上表现差\n\n模型在"死记硬背",没有学会真正的规律!',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'epoch', condition: '>=', threshold: 1000 }
      },
      {
        id: 'exp3_step5_diagnosis',
        guidanceText: '🔍 故障诊断\n\n【为什么会过拟合?】\n想象一个学生:\n- 不理解知识点\n- 把教科书上的每一道题都背下来\n- 考试遇到新题就傻眼了\n\n神经网络也是一样:\n- 模型太大(20个神经元)\n- 训练太久(1500轮)\n- 记住了噪音,而不是规律\n\n【解决方案】\n1. 减少神经元数量(降低模型容量)\n2. 早停(Early Stopping)\n3. 使用正则化\n4. 增加训练数据',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp3_step6_apply_fix',
        targetId: 'fault-btn-apply-fix',
        guidanceText: '💡 修复过拟合!\n\n🔧 推荐修复:\n- 神经元数量:20 → 4(减少容量)\n- 训练轮数:1500 → 300(早停)\n\n点击【应用修复方案】!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp3_step7_verify_fix',
        targetId: 'fault-btn-train',
        guidanceText: '修复已应用!现在用小模型重新训练。\n\n点击【开始训练】验证效果!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp3_step8_observe_healthy',
        targetId: 'fault-loss-chart-container',
        guidanceText: '✅ 修复成功!\n\n观察修复后的训练:\n\n📈 两条Loss曲线都在下降\n📉 它们没有分离\n\n这说明模型在学习"真正的规律",而不是死记硬背!\n\n对比:\n| 指标 | 修复前 | 修复后 |\n|------|--------|--------|\n| 神经元数 | 20 | 4 |\n| 训练轮数 | 1500 | 300 |\n| 泛化能力 | 差 | 好 |',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 80 }
      },
      {
        id: 'exp3_step9_summary',
        guidanceText: '📋 实验总结\n\n【过拟合】\n🟡 症状:训练Loss低,验证Loss高\n🧠 原因:模型太大 + 训练太久\n💊 药方:\n  - 减少神经元\n  - 早停\n  - 正则化\n  - 增加数据\n\n💡 核心概念:泛化能力\n好的模型不仅要记住训练数据,\n更要学会预测新数据!\n\n恭喜完成【过拟合】实验!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  },

  // ============================================================================
  // 实验4:数据污染
  // ============================================================================
  {
    id: 'FAULT_EXP_4_DATA_POISONING',
    title: '实验4:数据污染',
    description: '极端离群点导致的模型扭曲,学会识别和修复',
    steps: [
      {
        id: 'exp4_step1_intro',
        targetId: 'fault-simulator',
        guidanceText: '🟣 数据污染实验\n\n欢迎来到第四个故障实验!\n\n【故障简介】\n数据污染是指训练数据中包含极端的"离群点",这些异常值会扭曲模型,让它学习到错误的规律。\n\n【制造方法】\n使用污染数据(包含极端离群点如x=90, y=-500)\n\n【体验目标】\n1. 观察离群点如何影响拟合曲线\n2. 理解数据质量的重要性\n3. 学习如何处理污染数据',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp4_step2_select_poisoned',
        targetId: 'fault-dataset-select',
        guidanceText: '🔧 请选择"污染数据"\n\n这组数据包含正常数据点和几个极端的离群点。\n\n观察画布上的红色标记 -- 那些就是离群点!\n\n- 正常数据在 x: 0~10, y: 5~25 范围\n- 离群点在 x: 90, y: -500\n\n这就像数据录入时打错了小数点位置。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 'poisoned'
      },
      {
        id: 'exp4_step3_observe_outliers',
        targetId: 'fault-graph-canvas',
        guidanceText: '观察画布上的离群点!\n\n红色标记的点是极端离群点:\n- 正常点在左下区域\n- 离群点在右上角的远处\n\n这些点可能是:\n- 数据录入错误\n- 传感器故障\n- 恶意注入的污染数据\n\n点击【下一步】继续。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp4_step4_train',
        targetId: 'fault-btn-train',
        guidanceText: '点击【开始训练】,观察污染数据的影响!\n\n拟合曲线会试图穿过这些离群点,导致整体拟合变差。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp4_step5_observe_distortion',
        targetId: 'fault-graph-canvas',
        guidanceText: '⚠️ 数据污染发生了!\n\n观察拟合曲线:\n\n📉 为了拟合那个极端的离群点(90, -500)\n📉 曲线被严重扭曲\n📉 在正常数据区域的拟合变得很差\n\n模型在"迎合"那些错误的数据点!',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 60 }
      },
      {
        id: 'exp4_step6_diagnosis',
        guidanceText: '🔍 故障诊断\n\n【为什么会这样?】\n想象一下:\n- 10个学生考试,平均分85\n- 但有1个学生作弊得了100分\n- 把这个学生算进去,平均分变成86.5\n- 校长会误以为整体水平提高了\n\n神经网络也是一样:\n- 离群点的Loss非常大\n- 模型拼命降低这个Loss\n- 结果扭曲了整体模型\n\n【解决方案】\n1. 数据清洗(移除离群点)\n2. 使用鲁棒损失函数(Huber Loss)\n3. 数据标准化\n4. 异常检测预处理',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'exp4_step7_apply_fix',
        targetId: 'fault-btn-apply-fix',
        guidanceText: '💡 修复数据污染!\n\n🔧 推荐修复:\n- 数据集:污染数据 → 标准数据\n\n这是最简单的修复方法 -- 移除污染数据!\n\n点击【应用修复方案】!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp4_step8_verify_fix',
        targetId: 'fault-btn-train',
        guidanceText: '修复已应用!现在使用干净的数据重新训练。\n\n点击【开始训练】验证效果!',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'exp4_step9_observe_healthy',
        targetId: 'fault-graph-canvas',
        guidanceText: '✅ 修复成功!\n\n观察修复后的拟合曲线:\n\n📈 曲线平滑地穿过正常数据点\n📈 没有被极端值扭曲\n📈 在整个数据范围内拟合良好\n\n对比:\n| 指标 | 修复前 | 修复后 |\n|------|--------|--------|\n| 数据集 | 污染数据 | 标准数据 |\n| 离群点 | 有 | 无 |\n| 拟合质量 | 差 | 好 |',
        triggerCondition: TriggerCondition.AUTO_INTERCEPT,
        interceptorRule: { monitor: 'loss', condition: 'plateau', threshold: 60 }
      },
      {
        id: 'exp4_step10_summary',
        guidanceText: '📋 实验总结\n\n【数据污染】\n🟣 症状:拟合曲线被极端点扭曲\n🧠 原因:离群点导致模型迎合错误数据\n💊 药方:\n  - 数据清洗\n  - 鲁棒损失函数\n  - 数据标准化\n\n💡 核心概念:数据质量\n好的模型需要好的数据!\nGarbage in, garbage out.\n\n恭喜完成【数据污染】实验!',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 模块六:高级专题引导实验
// ============================================================================

export const llmScenarios: Experiment[] = [
  {
    id: 'LLM_TRANSFORMER',
    title: 'LLM 专题:打开 Transformer 的黑盒',
    description: '通过可视化 Token 嵌入、自注意力和在线训练,理解大语言模型的工作原理。',
    steps: [
      {
        id: 'llm_step_1_intro',
        targetId: 'llm-control-panel',
        guidanceText: '欢迎来到 LLM 专题!这个实验将带你揭开 Transformer 架构的神秘面纱。首先观察右侧的控制面板,可以看到有"训练模式"和"推理模式"两种实验方式。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'llm_step_2_theme_selection',
        targetId: 'llm-training-info',
        guidanceText: '在训练模式下,先选择训练主题。有三种主题可选:问答训练、故事生成、技术文档。不同的主题会让模型学习不同的语言模式。注意:这里模拟的是模型"微调"(Fine-tuning)过程--模型已经在大量通用文本上学会了语言能力,我们再让它专门学习特定任务的模式。真正的"预训练"是在更大规模的通用语料上进行的。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'llm_step_3_first_train',
        targetIds: ['llm-train-step-button', 'llm-train-toggle-button'],
        guidanceText: '点击"单步训练"按钮,观察损失曲线(Loss)的变化。Loss 表示模型预测的误差,数值越低越好。你也可以点击"开始训练"进行连续训练。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'llm_step_4_observe_loss',
        targetIds: ['llm-learning-rate-slider', 'llm-loss-chart'],
        guidanceText: '观察损失曲线是否在下降?如果损失下降,说明模型正在学习!调整学习率滑块,看看不同学习率对训练速度的影响。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.1,
        targetValueOperator: '>='
      },
      {
        id: 'llm_step_5_switch_mode',
        targetId: 'llm-mode-inference',
        guidanceText: '训练一段时间后,点击"推理模式"。这里我们将可视化 LLM 的内部工作原理:Token 嵌入和注意力机制。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'llm_step_6_token_embedding',
        targetId: 'llm-token-embed',
        guidanceText: '现在观察"Token 嵌入可视化"面板。输入一个提示词,观察每个词(Token)如何被转换为向量表示。柱状图显示向量的各个维度。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'llm_step_7_attention',
        targetId: 'llm-attention-viz',
        guidanceText: '接下来观察"注意力机制可视化"。热力图显示了模型在处理每个词时,对其他词的"关注程度"。颜色越深,注意力越强。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'llm_step_8_attention_heads',
        targetId: 'llm-attention-viz',
        guidanceText: '注意面板下方显示的"各注意力头权重"。我们的模型有 4 个注意力头,每个头可能关注不同的语义关系。尝试理解每个头学到了什么模式。',
        triggerCondition: TriggerCondition.NEXT_BUTTON
      },
      {
        id: 'llm_step_9_generation',
        targetId: 'llm-generation-panel',
        guidanceText: '最后,尝试生成文本!输入一个提示词,点击"生成文本"按钮。观察概率分布柱状图,看看模型认为下一个词应该是什么。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'llm_step_10_temperature',
        targetIds: ['llm-temperature-slider', 'llm-generation-panel'],
        guidanceText: '调整 Temperature(温度)参数。低温度让模型更"确定",总是选择最可能的词;高温度让模型更"随机",产生更多样化的输出。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 1.0,
        targetValueOperator: '>='
      },
      {
        id: 'llm_step_11_reflection',
        guidanceText: '思考一下:Transformer是如何做到理解上下文并生成合理文本的?',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: 'Token嵌入和注意力机制分别解决了什么问题?',
          options: [
            { text: 'Token嵌入用于分词，注意力机制用于翻译', isCorrect: false },
            { text: 'Token嵌入将词转换为向量表示语义，注意力机制让模型关注相关的词', isCorrect: true },
            { text: 'Token嵌入压缩文本，注意力机制加密信息', isCorrect: false },
            { text: '两者功能相同，都是为了加快训练速度', isCorrect: false }
          ],
          explanation: 'Token嵌入解决了"让计算机理解词义"的问题——语义相似的词在向量空间中距离更近。注意力机制解决了"理解上下文关系"的问题——让模型学会关注与当前词最相关的其他词，而不是盲目处理所有输入。'
        }
      },
      {
        id: 'llm_step_12_completion',
        guidanceText: '恭喜完成 LLM 专题!你已经体验了 Transformer 架构的核心组件:Token 嵌入、自注意力和语言模型头。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

export const yoloScenarios: Experiment[] = [
  {
    id: 'YOLO_BASICS',
    title: 'YOLO 专题:从标注到 NMS',
    description: '通过标注、训练和阈值筛选,理解目标检测模型如何学习和预测。',
    steps: [
      {
        id: 'yolo_step_1_label_targets',
        targetId: 'yolo-label-panel',
        guidanceText: '先完成标注。请把图中的"人"和"书包"都加入真值框,再点击"下一步"。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'yolo_step_2_train_once',
        targetId: 'yolo-btn-train',
        guidanceText: '点击"训练 1 轮",让模型开始把预测框往真值框上贴。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'yolo_step_3_observe_iou',
        targetIds: ['yolo-training-panel', 'yolo-detection-canvas'],
        guidanceText: '继续训练,直到主框 IoU 足够高。💡 IoU = Intersection over Union,即"预测框"与"真实框"的交集面积除以并集面积,范围 0~1,越接近 1 表示预测越准。观察预测框(虚线)是否越来越贴近真值框(实线),达到后点击"下一步"。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'yolo_step_4_confidence',
        targetId: 'yolo-confidence-slider',
        guidanceText: '拖动置信度阈值到 0.50 或更高,观察低分假框如何先被过滤掉。💡 为什么模型会输出很多重叠的框?YOLO 在图像上划分网格,每个格子预测多个候选框,再通过置信度和 NMS 筛选最终结果——这一步叫做"非极大值抑制(NMS)"。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.5,
        targetValueOperator: '>='
      },
      {
        id: 'yolo_step_5_nms',
        targetId: 'yolo-nms-slider',
        guidanceText: '再把 NMS IoU 阈值调到 0.40 或更低,观察重复的人框如何被抑制。',
        triggerCondition: TriggerCondition.VALUE_CHANGE,
        targetValue: 0.4,
        targetValueOperator: '<='
      },
      {
        id: 'yolo_step_6_observe_status',
        targetId: 'yolo-status-panel',
        guidanceText: '查看右侧候选框状态表,确认哪些框是"低于阈值",哪些框是"被 NMS 抑制"。',
        triggerCondition: TriggerCondition.ON_CLICK
      },
      {
        id: 'yolo_step_7_reflection',
        guidanceText: 'YOLO为什么不是直接输出最终框?',
        triggerCondition: TriggerCondition.REFLECTION_SUBMIT,
        requireReflection: {
          type: 'choice',
          questionText: '置信度阈值和NMS分别解决了什么问题?',
          options: [
            { text: '置信度阈值用于过滤低质量框，NMS用于去除重复框', isCorrect: true },
            { text: '置信度阈值用于调整模型精度，NMS用于加速推理', isCorrect: false },
            { text: '两者都是用来训练模型的', isCorrect: false },
            { text: '置信度阈值用于数据增强，NMS用于特征提取', isCorrect: false }
          ],
          explanation: 'YOLO在图像上划分网格，每个格子预测多个候选框。置信度阈值(如0.5)过滤掉"我不确定这里有物体"的低置信度框；NMS(非极大值抑制)处理"这里有多个重叠的框，该留哪个"的问题，保留IoU最大的框。'
        }
      },
      {
        id: 'yolo_step_8_completion',
        guidanceText: '恭喜完成 YOLO 专题引导!你已经体验了从标注到后处理筛选的关键流程。',
        triggerCondition: TriggerCondition.COMPLETION_CHOICE
      }
    ]
  }
];

// ============================================================================
// 模块六:课程序列定义
// ============================================================================

export type LabId = 'LINEAR' | 'LOGISTIC' | 'TREE' | 'NN' | 'FAULT';

/**
 * 课程步骤定义
 * 依次引导用户完成:线性回归 → 逻辑回归 → 决策树 → 神经网络 → 故障实验台
 */
export const curriculumSequence: { labId: LabId; experimentId: string; title: string; icon: string }[] = [
  {
    labId: 'LINEAR',
    experimentId: 'LINEAR_BASICS',
    title: '线性回归',
    icon: '📈'
  },
  {
    labId: 'LOGISTIC',
    experimentId: 'LOGISTIC_BASICS',
    title: '逻辑回归',
    icon: '🟠🔵'
  },
  {
    labId: 'TREE',
    experimentId: 'TREE_BASICS',
    title: '决策树',
    icon: '🌲'
  },
  {
    labId: 'NN',
    experimentId: 'NN_EXP_1_DATA_AND_TRAINING',
    title: '神经网络',
    icon: '🧠'
  },
  {
    labId: 'FAULT',
    experimentId: 'FAULT_EXP_1_GRADIENT_EXPLOSION',
    title: '故障诊断',
    icon: '⚠️'
  }
];

/**
 * 获取课程中所有实验的合并数组
 */
export const allScenarios = [
  ...linearRegressionScenarios,
  ...logisticRegressionScenarios,
  ...decisionTreeScenarios,
  ...nnExperiments, // 神经网络渐进式课程
  ...faultScenarios, // 旧版33步场景(保留用于兼容)
  ...faultExperiments // 新版4个独立实验
];

/**
 * 获取故障实验台的所有实验(包括旧的和新的)
 */
export function getFaultExperiments(): Experiment[] {
  return faultExperiments;
}

/**
 * 根据实验ID查找实验
 */
export function findExperimentById(id: string): Experiment | undefined {
  return allScenarios.find((exp) => exp.id === id);
}

/**
 * 根据实验室ID获取对应的实验
 */
export function getExperimentsForLab(labId: LabId): Experiment[] {
  switch (labId) {
    case 'LINEAR': return linearRegressionScenarios;
    case 'LOGISTIC': return logisticRegressionScenarios;
    case 'TREE': return decisionTreeScenarios;
    case 'NN': return nnExperiments;
    case 'FAULT': return faultExperiments; // 返回新版4个独立实验
    default: return [];
  }
}

/**
 * 根据实验室ID获取第一个实验的ID(用于初始化)
 */
export function getFirstExperimentIdForLab(labId: LabId): string {
  switch (labId) {
    case 'LINEAR': return 'LINEAR_BASICS';
    case 'LOGISTIC': return 'LOGISTIC_BASICS';
    case 'TREE': return 'TREE_BASICS';
    case 'NN': return 'NN_EXP_1_DATA_AND_TRAINING';
    case 'FAULT': return 'FAULT_EXP_1_GRADIENT_EXPLOSION';
    default: return '';
  }
}
