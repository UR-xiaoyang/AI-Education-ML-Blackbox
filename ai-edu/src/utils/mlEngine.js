export function predict(x, w, b) {
  return w * x + b;
}

export function computeLoss(points, w, b) {
  if (points.length === 0) return 0;
  let totalError = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const yPred = predict(p.x, w, b);
    totalError += (p.y - yPred) ** 2; // MSE (Mean Squared Error)
  }
  return totalError / points.length;
}

/**
 * 计算当前参数的梯度（用于可视化梯度下降过程）
 * gradient = (2/N) * sum(x_i * (yPred_i - y_i))
 */
export function computeGradients(points, w, b) {
  if (points.length === 0) return { wGradient: 0, bGradient: 0 };
  let wGradient = 0;
  let bGradient = 0;
  const N = points.length;
  for (let i = 0; i < N; i++) {
    const x = points[i].x;
    const y = points[i].y;
    const yPred = predict(x, w, b);
    wGradient += (2 / N) * x * (yPred - y);
    bGradient += (2 / N) * (yPred - y);
  }
  return { wGradient, bGradient };
}

export function gradientDescentStep(points, w, b, learningRate) {
  let wGradient = 0;
  let bGradient = 0;
  const N = points.length;
  
  if (N === 0) return { w, b };

  for (let i = 0; i < N; i++) {
    // 剧本引擎防呆检查：
    // 在执行梯度计算（Gradient Descent）的公式中，必须直接使用原始的 X 值进行求导计算
    // （即 w_new = w_old - lr * gradient）。
    // 绝对不能在这里对数据进行 Standard Scaler (归一化) 处理，
    // 否则我们将无法向学生展示“未归一化的大数值特征”是如何导致梯度爆炸的（投毒将失效）。
    const x = points[i].x;
    const y = points[i].y;
    // Derivative of MSE: 2/N * (yPred - y) * x
    const yPred = predict(x, w, b);
    wGradient += (2 / N) * x * (yPred - y);
    bGradient += (2 / N) * (yPred - y);
  }

  // Update parameters
  const newW = w - (learningRate * wGradient);
  const newB = b - (learningRate * bGradient);
  
  return { w: newW, b: newB };
}


/* Logistic Regression (New Support) */

export function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

// Predict probability for logistic regression (2 features: x1, x2)
export function predictLogistic(x1, x2, w1, w2, b) {
  const z = w1 * x1 + w2 * x2 + b;
  return sigmoid(z);
}

// Compute Binary Cross Entropy Loss
export function computeCrossEntropyLoss(points, w1, w2, b) {
  if (points.length === 0) return 0;
  let totalLoss = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const p_hat = predictLogistic(p.x, p.y, w1, w2, b);
    // Clip p_hat to avoid log(0)
    const p_clipped = Math.max(Math.min(p_hat, 0.99999), 0.00001);
    
    if (p.label === 1) {
      totalLoss -= Math.log(p_clipped);
    } else {
      totalLoss -= Math.log(1 - p_clipped);
    }
  }
  return totalLoss / points.length;
}

// One step of gradient descent for logistic regression
export function logisticGradientDescentStep(points, w1, w2, b, learningRate) {
  let w1Gradient = 0;
  let w2Gradient = 0;
  let bGradient = 0;
  const N = points.length;
  
  if (N === 0) return { w1, w2, b };

  for (let i = 0; i < N; i++) {
    const x1 = points[i].x;
    const x2 = points[i].y;
    const y = points[i].label; // 0 or 1
    
    const p_hat = predictLogistic(x1, x2, w1, w2, b);
    const error = p_hat - y; // derivative of BCE wrt z is (p - y)
    
    w1Gradient += error * x1;
    w2Gradient += error * x2;
    bGradient += error;
  }

  w1Gradient /= N;
  w2Gradient /= N;
  bGradient /= N;

  return {
    w1: w1 - learningRate * w1Gradient,
    w2: w2 - learningRate * w2Gradient,
    b: b - learningRate * bGradient
  };
}
