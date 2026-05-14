// 计算基尼不纯度 (Gini Impurity)
export function calculateGini(points) {
  if (points.length === 0) return 0;
  let count0 = 0, count1 = 0;
  for (const p of points) {
    if (p.label === 0) count0++;
    else count1++;
  }
  const p0 = count0 / points.length;
  const p1 = count1 / points.length;
  // Gini = 1 - sum(p_i^2)
  return 1 - (p0 * p0 + p1 * p1);
}

// 寻找最佳分裂点 (ID3/CART 算法核心思想)
export function findBestSplit(points) {
  let bestGini = Infinity;
  let bestSplit = null;
  
  if (points.length < 2) return null;
  const currentGini = calculateGini(points);
  if (currentGini === 0) return null; // 已经是纯节点，无需分裂

  const features = ['x', 'y'];
  
  for (const feature of features) {
    // 按照该特征排序
    const sorted = [...points].sort((a, b) => a[feature] - b[feature]);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i][feature] === sorted[i+1][feature]) continue;
      
      const splitVal = (sorted[i][feature] + sorted[i+1][feature]) / 2;
      
      const left = sorted.slice(0, i + 1);
      const right = sorted.slice(i + 1);
      
      const giniLeft = calculateGini(left);
      const giniRight = calculateGini(right);
      
      // 加权基尼系数 (Weighted Gini)
      const gini = (left.length * giniLeft + right.length * giniRight) / points.length;
      
      if (gini < bestGini) {
        bestGini = gini;
        bestSplit = { feature, val: splitVal, left, right };
      }
    }
  }
  
  return bestSplit;
}

// 递归构建决策树
export function buildDecisionTree(points, depth, maxDepth) {
  if (points.length === 0) return { label: 0, depth };
  
  let count0 = 0, count1 = 0;
  for (const p of points) {
    if (p.label === 0) count0++;
    else count1++;
  }
  const majorityLabel = count1 > count0 ? 1 : 0;
  
  if (depth >= maxDepth || count0 === 0 || count1 === 0) {
    return { label: majorityLabel, count0, count1, depth }; // 叶子节点
  }
  
  const split = findBestSplit(points);
  if (!split) {
    return { label: majorityLabel, count0, count1, depth }; // 无法继续分裂
  }
  
  return {
    splitFeature: split.feature,
    splitValue: split.val,
    left: buildDecisionTree(split.left, depth + 1, maxDepth),
    right: buildDecisionTree(split.right, depth + 1, maxDepth),
    depth
  };
}

// 遍历决策树，将其转换为可供渲染的二维区块 (Regions)
// 逻辑坐标系: x[0,1], y[0,1]
export function getTreeRegions(node, minX = 0, maxX = 1, minY = 0, maxY = 1) {
  if (!node) return [];

  if (node.label !== undefined && !node.left) { 
    // 叶子节点
    return [{ minX, maxX, minY, maxY, label: node.label, depth: node.depth }];
  }
  
  let regions = [];
  if (node.splitFeature === 'x') {
    regions = regions.concat(getTreeRegions(node.left, minX, node.splitValue, minY, maxY));
    regions = regions.concat(getTreeRegions(node.right, node.splitValue, maxX, minY, maxY));
  } else {
    // Y特征分裂
    regions = regions.concat(getTreeRegions(node.left, minX, maxX, minY, node.splitValue));
    regions = regions.concat(getTreeRegions(node.right, minX, maxX, node.splitValue, maxY));
  }
  return regions;
}
